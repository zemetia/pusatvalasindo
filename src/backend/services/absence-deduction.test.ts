import { describe, it, expect } from "vitest";
import { computeAbsenceDeduction, type AbsenceRecord } from "./absence-deduction";

// Angka bulat supaya hasilnya bisa dibaca tanpa kalkulator: upah harian
// Rp 100.000, uang makan + transport Rp 25.000 per hari.
const RATES = { dailyRate: 100_000, dailyFieldAllowance: 25_000 };

const rec = (status: string, isWithDoctorNote = false): AbsenceRecord => ({
  status,
  isWithDoctorNote,
});

const hitung = (records: AbsenceRecord[], alphaWithoutRecord = 0) =>
  computeAbsenceDeduction({ records, alphaWithoutRecord, ...RATES });

describe("computeAbsenceDeduction", () => {
  it("hari kerja normal tidak memotong apa pun", () => {
    const { total } = hitung([rec("PRESENT"), rec("WFH"), rec("HOLIDAY")]);
    expect(total).toBe(0);
  });

  it("keterlambatan tidak dipotong di sini — itu rule denda_keterlambatan", () => {
    expect(hitung([rec("LATE")]).total).toBe(0);
  });

  it("sakit dengan surat dokter dipotong 1× upah harian", () => {
    expect(hitung([rec("SICK", true)]).total).toBe(100_000);
  });

  it("sakit tanpa surat dokter dipotong 2× upah harian", () => {
    expect(hitung([rec("SICK", false)]).total).toBe(200_000);
  });

  it("izin selalu 1× upah harian, surat dokter tidak berpengaruh", () => {
    expect(hitung([rec("PERMISSION", false)]).total).toBe(100_000);
    expect(hitung([rec("PERMISSION", true)]).total).toBe(100_000);
  });

  it("cuti resmi hanya memotong uang makan & transport hari itu", () => {
    expect(hitung([rec("LEAVE")]).total).toBe(25_000);
  });

  it("alpha tercatat dan alpha tanpa catatan dipotong sama besar", () => {
    const tercatat = hitung([rec("ABSENT")]).total;
    const tanpaCatatan = hitung([], 1).total;
    expect(tercatat).toBe(200_000);
    expect(tanpaCatatan).toBe(tercatat);
  });

  it("menjumlahkan seluruh kategori dan melaporkan jumlah harinya", () => {
    const { total, days } = hitung(
      [
        rec("PRESENT"),
        rec("SICK", true), // 100.000
        rec("SICK", false), // 200.000
        rec("PERMISSION"), // 100.000
        rec("LEAVE"), //  25.000
        rec("ABSENT"), // 200.000
      ],
      2 // alpha tanpa catatan → 400.000
    );

    expect(total).toBe(1_025_000);
    expect(days).toEqual({
      sakit: 1,
      sakitTanpaSurat: 1,
      izin: 1,
      cuti: 1,
      alphaTercatat: 1,
      alphaTanpaCatatan: 2,
    });
  });
});
