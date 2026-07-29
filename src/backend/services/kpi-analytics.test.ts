import { describe, it, expect } from "vitest";
import { buildPeriods } from "./kpi-analytics.service";

/**
 * Deretan periode dipakai untuk kolom tren 6 bulan. Kalau pergantian tahunnya
 * meleset, grafiknya tetap tergambar rapi — cuma menampilkan bulan yang salah,
 * dan tidak ada yang menyadarinya. Karena itu diuji terpisah.
 */
describe("buildPeriods", () => {
  it("mengembalikan periode urut lama → baru, termasuk bulan acuan", () => {
    expect(buildPeriods(7, 2026, 3)).toEqual([
      { month: 5, year: 2026 },
      { month: 6, year: 2026 },
      { month: 7, year: 2026 },
    ]);
  });

  it("mundur melewati pergantian tahun", () => {
    expect(buildPeriods(2, 2026, 4)).toEqual([
      { month: 11, year: 2025 },
      { month: 12, year: 2025 },
      { month: 1, year: 2026 },
      { month: 2, year: 2026 },
    ]);
  });

  it("Januari mundur 6 bulan berhenti di Agustus tahun sebelumnya", () => {
    const periods = buildPeriods(1, 2026, 6);
    expect(periods[0]).toEqual({ month: 8, year: 2025 });
    expect(periods[periods.length - 1]).toEqual({ month: 1, year: 2026 });
  });

  it("mundur lebih dari setahun tetap benar", () => {
    const periods = buildPeriods(3, 2026, 15);
    expect(periods).toHaveLength(15);
    expect(periods[0]).toEqual({ month: 1, year: 2025 });
    expect(periods[periods.length - 1]).toEqual({ month: 3, year: 2026 });
  });

  it("count 1 hanya berisi bulan acuan", () => {
    expect(buildPeriods(12, 2026, 1)).toEqual([{ month: 12, year: 2026 }]);
  });

  it("tidak pernah menghasilkan bulan di luar 1–12", () => {
    for (let m = 1; m <= 12; m++) {
      for (const p of buildPeriods(m, 2026, 18)) {
        expect(p.month).toBeGreaterThanOrEqual(1);
        expect(p.month).toBeLessThanOrEqual(12);
      }
    }
  });
});
