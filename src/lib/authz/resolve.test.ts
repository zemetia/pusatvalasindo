import { describe, it, expect } from "vitest";
import {
  resolve,
  allows,
  allowsCompany,
  companyFilter,
  type AuthzSubject,
  type ResourceGrant,
} from "./resolve";

const PT_A = "pt-a";
const PT_B = "pt-b";
const PT_C = "pt-c";

function subject(over: Partial<AuthzSubject> = {}): AuthzSubject {
  return {
    roleName: "Kasir",
    companyId: PT_A,
    grants: [],
    migrated: true,
    legacyPermissions: [],
    ...over,
  };
}

function grant(over: Partial<ResourceGrant> & { resource: string }): ResourceGrant {
  return {
    viewScope: "NONE",
    viewCompanyIds: [],
    writeScope: "NONE",
    writeCompanyIds: [],
    ...over,
  };
}

describe("resolve", () => {
  it("memberi akses penuh untuk role global tanpa melihat matriks", () => {
    for (const roleName of ["SUPER_ADMIN", "OWNER", "Super Admin", "owner"]) {
      const d = resolve(subject({ roleName, grants: [] }), "apapun", "write");
      expect(d.allowed).toBe(true);
      expect(d.companyIds).toBeNull();
    }
  });

  it("menolak resource yang tidak ada di matriks jabatan yang sudah dimigrasi", () => {
    const s = subject({ grants: [grant({ resource: "bank.daily", viewScope: "OWN" })] });
    expect(allows(s, "stockist.daily", "view")).toBe(false);
  });

  it("tetap menolak walau izin lama masih ada, setelah jabatan dimigrasi", () => {
    // Inilah yang membuat pencabutan akses benar-benar berlaku.
    const s = subject({
      grants: [],
      migrated: true,
      legacyPermissions: ["stockist.view"],
    });
    expect(allows(s, "stockist.daily", "view")).toBe(false);
  });

  it("jatuh balik ke izin lama saat jabatan belum dimigrasi", () => {
    const s = subject({
      grants: [],
      migrated: false,
      legacyPermissions: ["stockist.view"],
    });
    const d = resolve(s, "stockist.daily", "view");
    expect(d.allowed).toBe(true);
    expect(d.companyIds).toEqual([PT_A]);
    // Izin tulis tidak ikut terbawa.
    expect(allows(s, "stockist.daily", "write")).toBe(false);
  });
});

describe("skenario inti: lihat PT A+B, ubah PT A saja", () => {
  const resource = "stockist.daily";

  const roleAtPtA = subject({
    companyId: PT_A,
    grants: [
      grant({
        resource,
        viewScope: "SELECTED",
        viewCompanyIds: [PT_A, PT_B],
        writeScope: "OWN",
      }),
    ],
  });

  // Jabatan bernama sama di PT B adalah BARIS ROLE BERBEDA, tanpa izin apa pun.
  const roleAtPtB = subject({ companyId: PT_B, grants: [] });

  it("boleh melihat PT A dan PT B", () => {
    expect(resolve(roleAtPtA, resource, "view").companyIds).toEqual([PT_A, PT_B]);
    expect(allowsCompany(roleAtPtA, resource, "view", PT_B)).toBe(true);
  });

  it("tidak boleh melihat PT yang tak diberikan", () => {
    expect(allowsCompany(roleAtPtA, resource, "view", PT_C)).toBe(false);
  });

  it("hanya boleh mengubah PT-nya sendiri", () => {
    expect(allowsCompany(roleAtPtA, resource, "write", PT_A)).toBe(true);
    expect(allowsCompany(roleAtPtA, resource, "write", PT_B)).toBe(false);
  });

  it("jabatan bernama sama di PT B tidak melihat halaman ini sama sekali", () => {
    expect(allows(roleAtPtB, resource, "view")).toBe(false);
    expect(allows(roleAtPtB, resource, "write")).toBe(false);
  });
});

describe("mode scope", () => {
  it("OWN tanpa PT ditolak, bukan diperlakukan sebagai semua PT", () => {
    const s = subject({
      companyId: null,
      grants: [grant({ resource: "r", viewScope: "OWN" })],
    });
    expect(allows(s, "r", "view")).toBe(false);
  });

  it("SELECTED dengan daftar kosong ditolak", () => {
    const s = subject({
      grants: [grant({ resource: "r", viewScope: "SELECTED", viewCompanyIds: [] })],
    });
    expect(allows(s, "r", "view")).toBe(false);
  });

  it("ALL berarti semua PT (companyIds null)", () => {
    const s = subject({ grants: [grant({ resource: "r", viewScope: "ALL" })] });
    const d = resolve(s, "r", "view");
    expect(d.companyIds).toBeNull();
    expect(allowsCompany(s, "r", "view", PT_C)).toBe(true);
  });

  it("resource global berlaku lintas seluruh PT", () => {
    const s = subject({
      companyId: PT_A,
      grants: [grant({ resource: "kpi.config", viewScope: "ALL", writeScope: "ALL" })],
    });
    const d = resolve(s, "kpi.config", "view");
    expect(d.companyIds).toBeNull();
    // Didelegasikan ke jabatan milik PT A, tapi tetap boleh menyentuh PT lain —
    // bobot KPI memang dipakai bersama seluruh PT.
    expect(allowsCompany(s, "kpi.config", "write", PT_C)).toBe(true);
  });

  it("resource global tanpa baris tetap ditolak untuk jabatan yang sudah dimigrasi", () => {
    const s = subject({ grants: [grant({ resource: "lain", viewScope: "OWN" })] });
    expect(allows(s, "kpi.config", "view")).toBe(false);
    expect(allows(s, "kpi.definitions", "view")).toBe(false);
    expect(allows(s, "kpi.review", "view")).toBe(false);
    expect(allows(s, "payroll.manage", "view")).toBe(false);
  });

  it("section Laporan global: didelegasikan sekali, berlaku untuk seluruh PT", () => {
    // Jabatan milik PT A yang diberi akses laporan. Laporannya memang lintas PT,
    // jadi tidak boleh dipersempit ke PT jabatan itu.
    const s = subject({
      companyId: PT_A,
      grants: [
        grant({ resource: "kpi.analytics", viewScope: "ALL" }),
        grant({ resource: "finance.report", viewScope: "ALL" }),
        grant({ resource: "watcher.valas", viewScope: "ALL" }),
      ],
    });
    for (const r of ["kpi.analytics", "finance.report", "watcher.valas"]) {
      expect(resolve(s, r, "view").companyIds).toBeNull();
      expect(allowsCompany(s, r, "view", PT_C)).toBe(true);
    }
  });

  it("Laporan tanpa baris ditolak, kecuali Watcher Valas yang punya jalur legacy", () => {
    const s = subject({ grants: [grant({ resource: "lain", viewScope: "OWN" })] });
    expect(allows(s, "kpi.analytics", "view")).toBe(false);
    expect(allows(s, "finance.report", "view")).toBe(false);
    expect(allows(s, "watcher.valas", "view")).toBe(false);

    // Sebelum dimigrasi, pemegang izin lama stockist.view tetap masuk Watcher
    // Valas — dan karena resource-nya global, aksesnya tidak terpotong per PT.
    const legacy = subject({ migrated: false, legacyPermissions: ["stockist.view"] });
    expect(allows(legacy, "watcher.valas", "view")).toBe(true);
    expect(allowsCompany(legacy, "watcher.valas", "view", PT_C)).toBe(true);
    // Dua laporan lainnya tetap tertutup sebelum didelegasikan eksplisit.
    expect(allows(legacy, "kpi.analytics", "view")).toBe(false);
    expect(allows(legacy, "finance.report", "view")).toBe(false);
  });

  it("ubah tanggal lampau adalah izin tersendiri, di-scope per PT", () => {
    // Boleh mengisi harian di PT A dan PT B, tapi hanya boleh membetulkan
    // angka tanggal lampau di PT A.
    const s = subject({
      companyId: PT_A,
      grants: [
        grant({
          resource: "stockist.daily",
          viewScope: "SELECTED",
          viewCompanyIds: [PT_A, PT_B],
          writeScope: "SELECTED",
          writeCompanyIds: [PT_A, PT_B],
        }),
        grant({
          resource: "daily.backdate",
          viewScope: "SELECTED",
          viewCompanyIds: [PT_A],
          writeScope: "SELECTED",
          writeCompanyIds: [PT_A],
        }),
      ],
    });
    expect(allowsCompany(s, "stockist.daily", "write", PT_B)).toBe(true);
    expect(allowsCompany(s, "daily.backdate", "write", PT_A)).toBe(true);
    expect(allowsCompany(s, "daily.backdate", "write", PT_B)).toBe(false);
  });

  it("tanpa izin backdate, mengisi harian tetap boleh", () => {
    const s = subject({
      grants: [grant({ resource: "stockist.daily", viewScope: "OWN", writeScope: "OWN" })],
    });
    expect(allowsCompany(s, "stockist.daily", "write", PT_A)).toBe(true);
    expect(allowsCompany(s, "daily.backdate", "write", PT_A)).toBe(false);
  });

  it("payroll bisa di-scope per PT", () => {
    // Jabatan di PT A yang dipercaya menghitung gaji PT A dan PT B.
    const s = subject({
      companyId: PT_A,
      grants: [
        grant({
          resource: "payroll.manage",
          viewScope: "SELECTED",
          viewCompanyIds: [PT_A, PT_B],
          writeScope: "SELECTED",
          writeCompanyIds: [PT_A, PT_B],
        }),
      ],
    });
    const d = resolve(s, "payroll.manage", "view");
    expect(d.companyIds).toEqual([PT_A, PT_B]);
    expect(allowsCompany(s, "payroll.manage", "write", PT_B)).toBe(true);
    expect(allowsCompany(s, "payroll.manage", "write", PT_C)).toBe(false);
  });

  it("KPI & payroll tidak punya jalur legacy — hanya role global yang lolos sebelum migrasi", () => {
    // Jabatan belum dimigrasi tapi masih memegang izin lama yang luas.
    const s = subject({
      migrated: false,
      legacyPermissions: ["kpi.manage", "kpi.view_all", "payroll.manage"],
    });
    for (const r of ["kpi.config", "kpi.definitions", "kpi.review", "payroll.manage"]) {
      expect(allows(s, r, "view")).toBe(false);
    }
    // Sementara Owner tetap masuk lewat isGlobalRole.
    expect(allows(subject({ roleName: "OWNER", migrated: false }), "kpi.config", "view")).toBe(true);
  });

  it("resource self-scoped mengabaikan dimensi PT", () => {
    const s = subject({
      companyId: null,
      grants: [grant({ resource: "kpi.self", viewScope: "OWN" })],
    });
    expect(allows(s, "kpi.self", "view")).toBe(true);
  });

  // Regresi: UI Jabatan merender resource "self" sebagai SATU sakelar, jadi
  // sumbu tulisnya tidak boleh dibaca terpisah. Data produksi hasil backfill
  // punya viewScope OWN + writeScope NONE untuk `attendance.self`, yang
  // membuat clock-in/clock-out 403 bagi seluruh jabatan non-global.
  it("resource self hanya punya satu sumbu — sakelar hidup berarti boleh menulis juga", () => {
    for (const resource of ["attendance.self", "kpi.self", "payroll.self"]) {
      const s = subject({ grants: [grant({ resource, viewScope: "OWN" })] });
      expect(allows(s, resource, "view")).toBe(true);
      expect(allows(s, resource, "write")).toBe(true);
    }
  });

  it("sakelar self yang mati menolak kedua sumbu", () => {
    const s = subject({ grants: [grant({ resource: "attendance.self" })] });
    expect(allows(s, "attendance.self", "view")).toBe(false);
    expect(allows(s, "attendance.self", "write")).toBe(false);
  });

  it("resource global tetap dua sumbu — hak lihat bukan hak ubah", () => {
    const s = subject({ grants: [grant({ resource: "kpi.config", viewScope: "ALL" })] });
    expect(allows(s, "kpi.config", "view")).toBe(true);
    expect(allows(s, "kpi.config", "write")).toBe(false);
  });

  it("jabatan belum dimigrasi: izin lama 'lihat presensi sendiri' cukup untuk clock-in", () => {
    // Model lama tidak punya permission \"boleh clock-in\" — cukup punya sesi.
    const s = subject({ migrated: false, legacyPermissions: ["attendance.view_own"] });
    expect(allows(s, "attendance.self", "view")).toBe(true);
    expect(allows(s, "attendance.self", "write")).toBe(true);
  });

  // `kpi.review` sengaja per-PT, tidak seperti kpi.config/kpi.definitions yang
  // global: yang dinilai adalah entri milik karyawan, dan karyawan dimiliki satu
  // PT lewat cabangnya.
  it("penilaian KPI di-scope per PT, terpisah dari konfigurasi KPI yang global", () => {
    const s = subject({
      grants: [
        grant({
          resource: "kpi.review",
          viewScope: "SELECTED",
          viewCompanyIds: [PT_A, PT_B],
          writeScope: "SELECTED",
          writeCompanyIds: [PT_A],
        }),
      ],
    });

    // Boleh memantau penilaian dua PT…
    expect(allowsCompany(s, "kpi.review", "view", PT_A)).toBe(true);
    expect(allowsCompany(s, "kpi.review", "view", PT_B)).toBe(true);
    expect(allowsCompany(s, "kpi.review", "view", PT_C)).toBe(false);
    // …tapi hanya menyetujui/mengunci di satu PT.
    expect(allowsCompany(s, "kpi.review", "write", PT_A)).toBe(true);
    expect(allowsCompany(s, "kpi.review", "write", PT_B)).toBe(false);

    // Memberi kpi.review TIDAK ikut membuka konfigurasi KPI yang global.
    expect(allows(s, "kpi.config", "view")).toBe(false);
    expect(allows(s, "kpi.definitions", "view")).toBe(false);
  });

  // Karyawan tanpa cabang punya companyId null. Sebelumnya kpi.service justru
  // menganggapnya peninjau lintas PT; di sini arah gagalnya harus menolak.
  it("peninjau tanpa PT tidak boleh menilai siapa pun", () => {
    const s = subject({
      companyId: null,
      grants: [grant({ resource: "kpi.review", viewScope: "OWN", writeScope: "OWN" })],
    });
    expect(allows(s, "kpi.review", "write")).toBe(false);
    expect(allowsCompany(s, "kpi.review", "write", PT_A)).toBe(false);
  });

  // Mata uang & harga valas: satu himpunan untuk seluruh PT, jadi scope-nya
  // global — memberi "PT sendiri" tidak boleh berarti separuh akses.
  it("mata uang & harga valas berlaku lintas PT, stok valas tetap per PT", () => {
    const s = subject({
      grants: [
        grant({ resource: "currency", viewScope: "OWN", writeScope: "OWN" }),
        grant({ resource: "currency.price", viewScope: "OWN" }),
        grant({ resource: "currency.stock", viewScope: "OWN" }),
      ],
    });

    // Global: tidak ada penyaringan per PT sama sekali.
    expect(resolve(s, "currency", "view").companyIds).toBeNull();
    expect(resolve(s, "currency.price", "view").companyIds).toBeNull();
    expect(allowsCompany(s, "currency", "write", PT_C)).toBe(true);

    // Stok valas melekat pada cabang, jadi tetap terkunci ke PT jabatannya.
    expect(resolve(s, "currency.stock", "view").companyIds).toEqual([PT_A]);
    expect(allowsCompany(s, "currency.stock", "view", PT_B)).toBe(false);
  });
});

describe("companyFilter", () => {
  it("tidak menyaring apa pun saat semua PT diizinkan", () => {
    expect(companyFilter({ allowed: true, scope: "ALL", companyIds: null })).toEqual({});
  });

  it("menyaring ke daftar PT yang diizinkan", () => {
    expect(companyFilter({ allowed: true, scope: "SELECTED", companyIds: [PT_A, PT_B] })).toEqual({
      companyId: { in: [PT_A, PT_B] },
    });
  });

  it("menghasilkan nol baris saat ditolak — gagal ke arah aman", () => {
    expect(companyFilter({ allowed: false, scope: "NONE", companyIds: [] })).toEqual({
      companyId: { in: [] },
    });
  });

  it("bisa menyaring lewat nama kolom lain", () => {
    expect(
      companyFilter({ allowed: true, scope: "OWN", companyIds: [PT_A] }, "branch.companyId")
    ).toEqual({ "branch.companyId": { in: [PT_A] } });
  });
});
