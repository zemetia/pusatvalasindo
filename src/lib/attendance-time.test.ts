import { describe, expect, it } from "vitest";

import {
  WORK_START_HOUR,
  WORK_START_LABEL,
  WORK_START_MINUTE,
  WORK_START_MINUTES,
  formatJakartaTime,
  jakartaMinutesOfDay,
  lateMinutesOf,
  workStartSqlExpr,
} from "./attendance-time";

/** Waktu WIB (UTC+7) sebagai Date — 07.40 WIB = 00.40 UTC. */
const wib = (hour: number, minute: number) =>
  new Date(Date.UTC(2026, 7, 3, hour - 7, minute));

/**
 * Batas diambil dari konstanta, bukan ditulis ulang sebagai angka.
 *
 * Tes yang mengetik "7" dan "40" sendiri akan tetap hijau setelah jam kerja
 * diubah — ia hanya menguji dirinya sendiri. Yang perlu dijamin adalah PERILAKU
 * relatif terhadap ambang: tepat di batas bukan telat, satu menit sesudahnya
 * telat satu menit.
 */
const batas = { jam: WORK_START_HOUR, menit: WORK_START_MINUTE };

describe("jam masuk WIB", () => {
  it("membaca jam menurut Asia/Jakarta, bukan zona waktu proses", () => {
    expect(jakartaMinutesOfDay(wib(17, 45))).toBe(17 * 60 + 45);
    expect(formatJakartaTime(wib(18, 5))).toBe("18.05");
  });

  it("jam masuk saat ini 07.40", () => {
    expect(WORK_START_LABEL).toBe("07.40");
    expect(WORK_START_HOUR).toBe(7);
    expect(WORK_START_MINUTE).toBe(40);
  });

  it("label selalu dua digit dan sesuai konstanta", () => {
    expect(WORK_START_LABEL).toBe(
      `${String(WORK_START_HOUR).padStart(2, "0")}.${String(WORK_START_MINUTE).padStart(2, "0")}`
    );
  });
});

describe("menit keterlambatan", () => {
  it("nol tepat pada batas dan sebelum itu", () => {
    expect(lateMinutesOf(wib(batas.jam, batas.menit))).toBe(0);
    expect(lateMinutesOf(wib(batas.jam - 1, 0))).toBe(0);
  });

  it("menghitung selisih menit dari batas", () => {
    expect(lateMinutesOf(wib(batas.jam, batas.menit + 1))).toBe(1);
    expect(lateMinutesOf(wib(batas.jam + 1, batas.menit + 5))).toBe(65);
    expect(lateMinutesOf(wib(batas.jam + 2, batas.menit + 30))).toBe(150);
  });

  it("tanpa jam masuk dihitung 0 menit — sama seperti SQL rule denda", () => {
    expect(lateMinutesOf(null)).toBe(0);
    expect(lateMinutesOf(undefined)).toBe(0);
  });
});

describe("ambang untuk SQL rule", () => {
  /**
   * SQL rule denda harus memotong dari ambang yang PERSIS sama dengan yang
   * dipakai server saat menetapkan status LATE. Kalau keduanya berbeda, slip
   * mendendakan menit yang bukan menit yang ditampilkannya.
   */
  it("menghasilkan menit yang sama dengan WORK_START_MINUTES", () => {
    // Ekspresinya dibaca ulang dari teksnya sendiri, lalu dihitung — memastikan
    // yang benar-benar dikirim ke Postgres bernilai sama dengan yang dipakai
    // TypeScript, bukan sekadar cocok sebagai string.
    const cocok = workStartSqlExpr().match(/^\((\d+) \* 60 \+ (\d+)\)$/);
    if (!cocok) throw new Error(`Bentuk ekspresi berubah: ${workStartSqlExpr()}`);
    const [, jam, menit] = cocok;
    expect(Number(jam) * 60 + Number(menit)).toBe(WORK_START_MINUTES);
  });
});
