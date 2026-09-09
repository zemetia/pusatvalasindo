import { describe, expect, it } from "vitest";

import {
  classifyWorkStartRole,
  formatJakartaTime,
  jakartaMinutesOfDay,
  lateMinutesOf,
  workStartLabelFor,
  workStartMinutesFor,
  workStartSqlExprFor,
} from "./attendance-time";

/** Waktu WIB (UTC+7) sebagai Date — 07.40 WIB = 00.40 UTC. */
const wib = (hour: number, minute: number) =>
  new Date(Date.UTC(2026, 7, 3, hour - 7, minute));

describe("jam masuk WIB", () => {
  it("membaca jam menurut Asia/Jakarta, bukan zona waktu proses", () => {
    expect(jakartaMinutesOfDay(wib(17, 45))).toBe(17 * 60 + 45);
    expect(formatJakartaTime(wib(18, 5))).toBe("18.05");
  });

  it("Kepala Cabang masuk 07.30, Karyawan masuk 07.55", () => {
    expect(workStartLabelFor("KEPALA_CABANG")).toBe("07.30");
    expect(workStartLabelFor("KARYAWAN")).toBe("07.55");
    expect(workStartMinutesFor("KEPALA_CABANG")).toBe(7 * 60 + 30);
    expect(workStartMinutesFor("KARYAWAN")).toBe(7 * 60 + 55);
  });
});

describe("classifyWorkStartRole", () => {
  it("mengenali Kepala Cabang dan aliasnya, bebas besar/kecil huruf dan spasi", () => {
    expect(classifyWorkStartRole("Kepala Cabang")).toBe("KEPALA_CABANG");
    expect(classifyWorkStartRole("KEPALA CABANG")).toBe("KEPALA_CABANG");
    expect(classifyWorkStartRole(" kepala cabang ")).toBe("KEPALA_CABANG");
    expect(classifyWorkStartRole("Kepala & Kasir")).toBe("KEPALA_CABANG");
  });

  it("jabatan lain, kosong, atau tidak dikenal jatuh ke Karyawan", () => {
    expect(classifyWorkStartRole("Kasir")).toBe("KARYAWAN");
    expect(classifyWorkStartRole("Kepala Marketing")).toBe("KARYAWAN");
    expect(classifyWorkStartRole(null)).toBe("KARYAWAN");
    expect(classifyWorkStartRole(undefined)).toBe("KARYAWAN");
    expect(classifyWorkStartRole("")).toBe("KARYAWAN");
  });
});

describe("menit keterlambatan", () => {
  it("nol tepat pada batas dan sebelum itu, untuk masing-masing ambang", () => {
    expect(lateMinutesOf(wib(7, 30), "KEPALA_CABANG")).toBe(0);
    expect(lateMinutesOf(wib(7, 0), "KEPALA_CABANG")).toBe(0);
    expect(lateMinutesOf(wib(7, 55), "KARYAWAN")).toBe(0);
    expect(lateMinutesOf(wib(7, 0), "KARYAWAN")).toBe(0);
  });

  it("menghitung selisih menit dari batas masing-masing ambang", () => {
    expect(lateMinutesOf(wib(7, 31), "KEPALA_CABANG")).toBe(1);
    expect(lateMinutesOf(wib(8, 35), "KEPALA_CABANG")).toBe(65);
    expect(lateMinutesOf(wib(7, 56), "KARYAWAN")).toBe(1);
    expect(lateMinutesOf(wib(9, 0), "KARYAWAN")).toBe(65);
  });

  it("jam masuk yang sama dinilai berbeda antar ambang", () => {
    // 07.45: telat untuk Kepala Cabang (batas 07.30), belum untuk Karyawan (07.55).
    expect(lateMinutesOf(wib(7, 45), "KEPALA_CABANG")).toBe(15);
    expect(lateMinutesOf(wib(7, 45), "KARYAWAN")).toBe(0);
  });

  it("tanpa jam masuk dihitung 0 menit — sama seperti SQL rule denda", () => {
    expect(lateMinutesOf(null, "KARYAWAN")).toBe(0);
    expect(lateMinutesOf(undefined, "KEPALA_CABANG")).toBe(0);
  });
});

describe("ambang untuk SQL rule", () => {
  /**
   * SQL rule denda harus memotong dari ambang yang PERSIS sama dengan yang
   * dipakai server saat menetapkan status LATE. Kalau keduanya berbeda, slip
   * mendendakan menit yang bukan menit yang ditampilkannya.
   */
  it("menghasilkan menit yang sama dengan workStartMinutesFor, untuk kedua ambang", () => {
    for (const role of ["KEPALA_CABANG", "KARYAWAN"] as const) {
      const cocok = workStartSqlExprFor(role).match(/^\((\d+) \* 60 \+ (\d+)\)$/);
      if (!cocok) throw new Error(`Bentuk ekspresi berubah: ${workStartSqlExprFor(role)}`);
      const [, jam, menit] = cocok;
      expect(Number(jam) * 60 + Number(menit)).toBe(workStartMinutesFor(role));
    }
  });
});
