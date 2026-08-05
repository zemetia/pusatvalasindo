import { beforeAll, describe, expect, it } from "vitest";

import {
  ExpressionError,
  MissingValueError,
  evaluate,
  parseCondition,
  parseFormula,
  roundRupiah,
} from "./formula";
import { validateRule } from "./validate";
import { bindNamedParams, buildPeriodContext } from "./engine";
import { toIsoDate } from "./loader";
import { canonicalize, signRule, verifyRuleSignature } from "./signature";
import { minIso } from "@/backend/services/payroll-rule.service";

const evalFormula = (src: string, scope: Record<string, unknown> = {}) =>
  evaluate(parseFormula(src), scope);

describe("formula — aritmetika", () => {
  it("menghormati urutan operasi dan kurung", () => {
    expect(evalFormula("2 + 3 * 4")).toBe(14);
    expect(evalFormula("(2 + 3) * 4")).toBe(20);
    expect(evalFormula("-3 + 10")).toBe(7);
  });

  it("mengevaluasi fungsi yang diizinkan", () => {
    expect(evalFormula("min(10, 24)")).toBe(10);
    expect(evalFormula("max(10, 24)")).toBe(24);
    expect(evalFormula("floor(7.9)")).toBe(7);
    expect(evalFormula("ceil(7.1)")).toBe(8);
    expect(evalFormula("abs(0 - 5)")).toBe(5);
  });

  it("membaca konstanta dengan maupun tanpa awalan `konstanta.`", () => {
    const scope = { hari_kerja_standar: 24 };
    expect(evalFormula("hari_kerja_standar", scope)).toBe(24);
    expect(evalFormula("konstanta.hari_kerja_standar", scope)).toBe(24);
  });

  it("menghitung uang makan prorata seperti contoh spesifikasi", () => {
    const scope = { hari_hadir: 10, hari_kerja_standar: 24, "karyawan.uang_makan": 600_000 };
    const src = "min(hari_hadir, hari_kerja_standar) * (karyawan.uang_makan / hari_kerja_standar)";
    expect(roundRupiah(evalFormula(src, scope))).toBe(250_000);
  });
});

describe("formula — yang harus ditolak", () => {
  it("tidak bisa dipakai menjalankan kode", () => {
    for (const src of [
      "process.exit(1)",
      "globalThis['x']",
      "require('fs')",
      "(() => 1)()",
      "a.b.c",
    ]) {
      expect(() => parseFormula(src), src).toThrow();
    }
  });

  it("menolak fungsi di luar daftar", () => {
    expect(() => parseFormula("sqrt(9)")).toThrow(ExpressionError);
    expect(() => parseFormula("random()")).toThrow(ExpressionError);
  });

  it("menolak jumlah argumen yang salah", () => {
    expect(() => parseFormula("min(1)")).toThrow(ExpressionError);
    expect(() => parseFormula("abs(1, 2)")).toThrow(ExpressionError);
  });

  it("menolak perbandingan di dalam formula tier", () => {
    expect(() => parseFormula("hari_hadir > 20")).toThrow(ExpressionError);
  });
});

describe("formula — nilai kosong", () => {
  // Menebak nol menghasilkan potongan yang tidak pernah diniatkan siapa pun:
  // karyawan yang `uang_makan`-nya belum diisi tidak boleh dianggap nol.
  it("melempar MissingValueError, bukan menganggapnya nol", () => {
    expect(() => evalFormula("karyawan.uang_makan * 2", { "karyawan.uang_makan": null })).toThrow(
      MissingValueError
    );
    expect(() => evalFormula("tidak_ada + 1")).toThrow(MissingValueError);
  });

  it("membaca 0 sebagai nol yang sah", () => {
    expect(evalFormula("hari_hadir * 1000", { hari_hadir: 0 })).toBe(0);
  });
});

describe("guard", () => {
  it("mengevaluasi perbandingan", () => {
    expect(evaluate(parseCondition("hari_tercatat == 0"), { hari_tercatat: 0 })).toBe(1);
    expect(evaluate(parseCondition("jumlah_peserta < 3"), { jumlah_peserta: 5 })).toBe(0);
  });

  it("membandingkan tanggal lewat nilai waktunya", () => {
    const node = parseCondition("karyawan.tgl_masuk > periode.awal");
    const scope = {
      "karyawan.tgl_masuk": new Date(2026, 7, 25),
      "periode.awal": new Date(2026, 7, 1),
    };
    expect(evaluate(node, scope)).toBe(1);
  });

  it("menolak kondisi yang bukan perbandingan", () => {
    expect(() => parseCondition("hari_hadir")).toThrow(ExpressionError);
    expect(() => parseCondition("1 < 2 < 3")).toThrow(ExpressionError);
  });
});

describe("bindNamedParams", () => {
  it("mengubah named parameter menjadi placeholder posisional", () => {
    const { text, values } = bindNamedParams(
      'SELECT 1 FROM "A" WHERE "userId" = :employee_id AND "date" >= :periode_awal',
      { employee_id: "U1", periode_awal: new Date(2026, 0, 1) }
    );
    expect(text).toContain("$1");
    expect(text).toContain("$2");
    expect(values[0]).toBe("U1");
  });

  it("memakai ulang placeholder untuk parameter yang sama", () => {
    const { text, values } = bindNamedParams(
      "SELECT :employee_id, :employee_id",
      { employee_id: "U1" }
    );
    expect(text).toBe("SELECT $1, $1");
    expect(values).toHaveLength(1);
  });

  it("tidak salah membaca cast Postgres sebagai parameter", () => {
    const { text, values } = bindNamedParams("SELECT COUNT(*)::int WHERE x = :employee_id", {
      employee_id: "U1",
    });
    expect(text).toBe("SELECT COUNT(*)::int WHERE x = $1");
    expect(values).toEqual(["U1"]);
  });
});

// ── Validator ──────────────────────────────────────────────────────────────

const baseRule = {
  id: "contoh",
  versi: 1,
  berlaku_dari: "2026-01-01",
  tipe: "bonus",
  mode: "agregat",
  query: {
    sql: "SELECT COUNT(*)::int AS hari_hadir FROM hv_attendance WHERE user_id = :employee_id AND date BETWEEN :periode_awal AND :periode_akhir",
    expect: "one_row",
  },
  tier_field: "hari_hadir",
  tiers: [{ min: 0, nominal: 1000, label: "Contoh" }],
  default: { nominal: 0 },
  for: [{ company: "*", branch: "*", roles: "*" }],
};

const errorsOf = (patch: Record<string, unknown>) =>
  validateRule({ ...baseRule, ...patch }, "contoh.json").errors;

describe("validateRule", () => {
  it("meloloskan rule yang sehat", () => {
    expect(errorsOf({})).toEqual([]);
  });

  it("menolak query tanpa filter periode", () => {
    const errors = errorsOf({
      query: {
        sql: "SELECT COUNT(*)::int AS hari_hadir FROM hv_attendance WHERE user_id = :employee_id",
        expect: "one_row",
      },
    });
    expect(errors.join(" ")).toMatch(/filter periode/);
  });

  it("menolak query yang mengubah data", () => {
    const errors = errorsOf({
      query: {
        sql: 'SELECT 1 AS hari_hadir FROM hv_attendance WHERE date = :periode_awal; DROP TABLE "user"',
        expect: "one_row",
      },
    });
    expect(errors.join(" ")).toMatch(/satu statement|DROP/);
  });

  // Penegak sesungguhnya adalah koneksi read-only ke database; cek ini ada
  // supaya salah tabel ketahuan saat rule DISIMPAN, bukan berupa error izin
  // saat payroll sedang berjalan.
  it("menolak query yang membaca tabel di luar view hv_", () => {
    const errors = errorsOf({
      query: {
        sql: 'SELECT COUNT(*)::int AS hari_hadir FROM "Attendance" WHERE date BETWEEN :periode_awal AND :periode_akhir',
        expect: "one_row",
      },
    });
    expect(errors.join(" ")).toMatch(/hanya boleh membaca view pelaporan/);
  });

  it("menolak JOIN ke tabel di luar view hv_", () => {
    const errors = errorsOf({
      query: {
        sql: 'SELECT COUNT(*)::int AS hari_hadir FROM hv_attendance a JOIN "user" u ON u.id = a.user_id WHERE a.date BETWEEN :periode_awal AND :periode_akhir',
        expect: "one_row",
      },
    });
    expect(errors.join(" ")).toMatch(/hanya boleh membaca view pelaporan/);
  });

  it("mengizinkan CTE yang isinya membaca view hv_", () => {
    const errors = errorsOf({
      query: {
        sql: "WITH peringkat AS (SELECT k.employee_id, RANK() OVER (ORDER BY k.total_score DESC) AS posisi FROM hv_kpi_monthly k WHERE k.month = :periode_bulan AND k.year = :periode_tahun) SELECT COALESCE(MAX(posisi), 0)::int AS hari_hadir FROM peringkat WHERE employee_id = :employee_id",
        expect: "one_row",
      },
      tierField: "hari_hadir",
    });
    expect(errors).toEqual([]);
  });

  it("menolak parameter yang tidak dikenal", () => {
    const errors = errorsOf({
      query: { sql: "SELECT 1 AS hari_hadir WHERE x = :nama_karyawan AND d = :periode_awal", expect: "one_row" },
    });
    expect(errors.join(" ")).toMatch(/:nama_karyawan/);
  });

  it("menolak tier yang tumpang tindih", () => {
    const errors = errorsOf({
      tiers: [
        { min: 20, nominal: 1000, label: "A" },
        { min: 22, max: 22, nominal: 500, label: "B" },
      ],
    });
    expect(errors.join(" ")).toMatch(/tumpang tindih/);
  });

  it("menolak lubang di antara tier", () => {
    const errors = errorsOf({
      tiers: [
        { max: 18, nominal: -1000, label: "A" },
        { min: 22, nominal: 1000, label: "B" },
      ],
    });
    expect(errors.join(" ")).toMatch(/celah/);
  });

  it("menolak tier yang mengisi lebih dari satu cara hitung", () => {
    const errors = errorsOf({
      tiers: [{ min: 0, nominal: 1000, formula: "hari_hadir * 2", label: "A" }],
    });
    expect(errors.join(" ")).toMatch(/hanya boleh mengisi SATU/);
  });

  it("menolak per_unit di mode agregat", () => {
    const errors = errorsOf({
      tiers: [{ min: 0, per_unit: 1000, unit_field: "hari_hadir", label: "A" }],
    });
    expect(errors.join(" ")).toMatch(/per_baris/);
  });

  it("menolak tier tanpa label", () => {
    expect(errorsOf({ tiers: [{ min: 0, nominal: 1000, label: "  " }] }).join(" ")).toMatch(
      /label/
    );
  });

  it("menolak rule tanpa default", () => {
    const { default: _drop, ...tanpaDefault } = baseRule;
    expect(validateRule(tanpaDefault, "contoh.json").errors.join(" ")).toMatch(/default/);
  });

  it("menolak pembagian dengan konstanta bernilai nol", () => {
    const errors = errorsOf({
      konstanta: { pembagi: 0 },
      tiers: [{ min: 0, formula: "hari_hadir / pembagi", label: "A" }],
    });
    expect(errors.join(" ")).toMatch(/[Pp]embagian dengan nol/);
  });
});

// ── Tanda tangan ───────────────────────────────────────────────────────────

const signable = {
  ruleKey: "denda_keterlambatan",
  version: 1,
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  type: "DENDA",
  mode: "PER_BARIS",
  sql: "SELECT 1 AS x FROM hv_attendance WHERE date = :periode_awal",
  tierField: "urutan_pelanggaran",
  constants: null,
  guards: null,
  defaults: { nominal: 0 },
  targets: [{ company: "*" }],
  excepts: null,
  tiers: [
    {
      sortOrder: 0,
      min: 1,
      max: null,
      nominal: null,
      perUnit: 1000,
      formula: null,
      unitField: "menit_telat",
      label: "Denda keterlambatan",
    },
  ],
};

describe("signature", () => {
  beforeAll(() => {
    process.env.PAYROLL_RULE_SIGNING_KEY = "kunci-uji-yang-cukup-panjang-1234567890";
  });

  it("menerima rule yang tidak berubah", () => {
    expect(verifyRuleSignature(signable, signRule(signable))).toBe(true);
  });

  it("menolak nominal yang diubah langsung di database", () => {
    const sig = signRule(signable);
    const diubah = {
      ...signable,
      tiers: [{ ...signable.tiers[0], perUnit: 50_000 }],
    };
    expect(verifyRuleSignature(diubah, sig)).toBe(false);
  });

  it("menolak SQL yang diubah langsung di database", () => {
    const sig = signRule(signable);
    expect(verifyRuleSignature({ ...signable, sql: "SELECT 2 AS x" }, sig)).toBe(false);
  });

  it("menolak masa berlaku yang diperpanjang diam-diam", () => {
    const sig = signRule(signable);
    expect(verifyRuleSignature({ ...signable, effectiveTo: "2030-01-01" }, sig)).toBe(false);
  });

  it("menolak tanda tangan kosong atau ngawur", () => {
    expect(verifyRuleSignature(signable, "")).toBe(false);
    expect(verifyRuleSignature(signable, "00".repeat(32))).toBe(false);
  });

  // Urutan penulisan field JSON tidak boleh mengubah tanda tangan — kalau iya,
  // rule yang sah akan tiba-tiba ditolak setelah round-trip lewat database.
  it("tidak terpengaruh urutan field di dalam objek", () => {
    const a = canonicalize(signable);
    const b = canonicalize({
      ...signable,
      defaults: { nominal: 0 },
      targets: [{ company: "*" }],
    });
    expect(a).toBe(b);
  });

  it("tidak membedakan 1000 dari 1000.00", () => {
    const sig = signRule(signable);
    const samaNilai = {
      ...signable,
      tiers: [{ ...signable.tiers[0], perUnit: "1000.00" }],
    };
    expect(verifyRuleSignature(samaNilai, sig)).toBe(true);
  });

  /**
   * Uji yang paling menentukan untuk seluruh fitur ini.
   *
   * Rule DITANDATANGANI dari input form (tanggal berupa string 'YYYY-MM-DD',
   * angka berupa `number`), lalu DIVERIFIKASI dari baris database (tanggal
   * berupa `Date` UTC-midnight, angka berupa Decimal Prisma). Kalau kedua
   * bentuk itu tidak menghasilkan payload yang sama, SETIAP rule akan ditolak
   * engine begitu dibaca ulang — dan gejalanya di slip gaji cuma berupa
   * reward/denda yang hilang tanpa penjelasan.
   */
  it("cocok antara bentuk simpan (string + number) dan bentuk baca (Date + Decimal)", () => {
    const decimalLike = (v: string) => ({ valueOf: () => v });

    const bentukSimpan = {
      ...signable,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-06-30",
      tiers: [{ ...signable.tiers[0], min: 1, perUnit: 1000 }],
    };

    const bentukBaca = {
      ...bentukSimpan,
      effectiveFrom: new Date(Date.UTC(2026, 0, 1)),
      effectiveTo: new Date(Date.UTC(2026, 5, 30)),
      tiers: [
        {
          ...signable.tiers[0],
          min: decimalLike("1"),
          max: null,
          nominal: null,
          perUnit: decimalLike("1000"),
        },
      ],
    };

    expect(canonicalize(bentukBaca)).toBe(canonicalize(bentukSimpan));
    expect(verifyRuleSignature(bentukBaca, signRule(bentukSimpan))).toBe(true);
  });
});

// ── Periode ────────────────────────────────────────────────────────────────

describe("buildPeriodContext", () => {
  it("mencakup hari terakhir bulan, apa pun zona waktu prosesnya", () => {
    const p = buildPeriodContext(8, 2026);
    // Regresi: sebelumnya batas periode dibangun dengan `new Date(y, m, d)`
    // lalu dikirim ke Postgres sebagai timestamp. Di proses yang berjalan di
    // WIB, 31 Agustus 00:00 WIB = 30 Agustus 17:00 UTC, sehingga `BETWEEN`
    // membuang hari terakhir setiap bulan tanpa error apa pun.
    expect(toIsoDate(p.awal)).toBe("2026-08-01");
    expect(toIsoDate(p.akhir)).toBe("2026-08-31");
    expect(p.jumlah_hari).toBe(31);
  });

  it("menghitung Februari kabisat dengan benar", () => {
    const p = buildPeriodContext(2, 2028);
    expect(toIsoDate(p.akhir)).toBe("2028-02-29");
    expect(p.jumlah_hari).toBe(29);
  });
});

describe("minIso — penutupan masa berlaku versi lama", () => {
  it("memperpendek saat versi lama masih terbuka", () => {
    expect(minIso(null, "2026-07-31")).toBe("2026-07-31");
  });

  it("TIDAK memperpanjang versi lama yang sudah dihentikan lebih awal", () => {
    // Versi lama berhenti 31 Mei; versi baru mulai 1 Agustus. Menimpa
    // `effectiveTo` dengan 31 Juli akan menghidupkan kembali rule itu selama
    // Juni–Juli, dan gaji dua bulan itu ikut berubah.
    expect(minIso("2026-05-31", "2026-07-31")).toBe("2026-05-31");
  });
});

describe("operator and/or", () => {
  const nilai = (src: string, scope: Record<string, unknown>) =>
    evaluate(parseCondition(src), scope);

  it("`and` benar hanya kalau kedua sisi terpenuhi", () => {
    expect(nilai("a == 1 and b == 2", { a: 1, b: 2 })).toBe(1);
    expect(nilai("a == 1 and b == 2", { a: 1, b: 9 })).toBe(0);
    expect(nilai("a == 1 and b == 2", { a: 9, b: 2 })).toBe(0);
  });

  it("`or` benar kalau salah satu terpenuhi — TERMASUK kalau keduanya", () => {
    expect(nilai("a == 1 or b == 2", { a: 1, b: 9 })).toBe(1);
    expect(nilai("a == 1 or b == 2", { a: 9, b: 2 })).toBe(1);
    // Inilah bedanya dengan trik lama `(A) + (B) == 1`, yang di baris ini
    // menghasilkan 0 karena 1+1 == 2 — XOR, bukan OR.
    expect(nilai("a == 1 or b == 2", { a: 1, b: 2 })).toBe(1);
    expect(nilai("a == 1 or b == 2", { a: 9, b: 9 })).toBe(0);
  });

  it("`and` mengikat lebih erat daripada `or`", () => {
    // Dibaca (a==1 and b==2) or c==3 — bukan a==1 and (b==2 or c==3).
    expect(nilai("a == 1 and b == 2 or c == 3", { a: 9, b: 9, c: 3 })).toBe(1);
    expect(nilai("a == 1 and b == 2 or c == 3", { a: 1, b: 9, c: 9 })).toBe(0);
  });

  it("kurung mengalahkan presedensi", () => {
    expect(nilai("(a == 1 or b == 2) and c == 3", { a: 1, b: 9, c: 3 })).toBe(1);
    expect(nilai("(a == 1 or b == 2) and c == 3", { a: 1, b: 9, c: 9 })).toBe(0);
  });

  it("bentuk lama berbasis perkalian tetap berjalan", () => {
    // Rule yang sudah tersimpan di database tidak boleh rusak oleh operator
    // baru ini.
    expect(nilai("(a == 1) * (b == 2) == 1", { a: 1, b: 2 })).toBe(1);
    expect(nilai("(a == 1) + (b == 2) >= 1", { a: 1, b: 9 })).toBe(1);
  });

  it("nilai kosong tetap dilaporkan meski sisi lain sudah menentukan", () => {
    // Tidak ada hubung-singkat: `a == 1` sudah cukup membuat `or` benar, tapi
    // `b` yang hilang tetap dilempar. Untuk uang, data separuh lebih baik
    // menahan rule daripada diam-diam menjawab "benar".
    expect(() => nilai("a == 1 or b == 2", { a: 1, b: null })).toThrow(MissingValueError);
  });

  it("kolom yang namanya berawalan and/or tetap terbaca sebagai rujukan", () => {
    expect(nilai("android == 1", { android: 1 })).toBe(1);
    expect(nilai("orang == 2", { orang: 2 })).toBe(1);
  });

  it("ditolak di dalam formula tier — formula menghasilkan rupiah, bukan benar/salah", () => {
    expect(() => parseFormula("a == 1 and b == 2")).toThrow(ExpressionError);
  });

  it("kondisi tanpa perbandingan sama sekali tetap ditolak", () => {
    expect(() => parseCondition("a + b")).toThrow(ExpressionError);
  });
});
