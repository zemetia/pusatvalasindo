import { describe, it, expect } from "vitest";
import {
  aggregatePerformance,
  NO_COMPANY,
  type EmployeePerformance,
} from "./kpi-analytics";

/**
 * Agregat ini dihitung ulang setiap kali filter di halaman berubah, jadi
 * kesalahannya muncul sebagai angka yang tetap terlihat masuk akal — tidak ada
 * yang error, hanya rata-ratanya salah. Karena itu diuji langsung.
 */

function row(over: Partial<EmployeePerformance> = {}): EmployeePerformance {
  return {
    employeeId: "e1",
    name: "Karyawan",
    roleName: "Kasir",
    branchId: "b1",
    branchName: "Cabang 1",
    companyId: "c1",
    companyCode: "PVI",
    companyName: "PT PVI",
    score: 1,
    grade: "A",
    prevScore: 1,
    deltaPct: 0,
    kpis: [],
    history: [null, null, 1],
    ...over,
  };
}

describe("aggregatePerformance", () => {
  it("karyawan tanpa skor ikut dihitung sebagai anggota tapi tidak menarik rata-rata", () => {
    const { totals, byRole } = aggregatePerformance([
      row({ employeeId: "a", score: 0.8, prevScore: null, grade: "B" }),
      row({ employeeId: "b", score: null, prevScore: null, grade: null }),
    ]);

    expect(totals.avgScore).toBe(0.8);
    expect(totals.employees).toBe(2);
    expect(totals.scored).toBe(1);
    expect(totals.unscored).toBe(1);
    expect(byRole[0].employees).toBe(2);
    expect(byRole[0].scored).toBe(1);
  });

  it("menghitung delta rata-rata terhadap bulan lalu", () => {
    const { totals } = aggregatePerformance([
      row({ employeeId: "a", score: 1.1, prevScore: 1 }),
      row({ employeeId: "b", score: 0.9, prevScore: 1 }),
    ]);

    expect(totals.avgScore).toBeCloseTo(1);
    expect(totals.prevAvgScore).toBe(1);
    expect(totals.avgDeltaPct).toBeCloseTo(0);
  });

  it("delta null saat tidak ada pembanding", () => {
    const { totals } = aggregatePerformance([row({ score: 1, prevScore: null })]);
    expect(totals.prevAvgScore).toBeNull();
    expect(totals.avgDeltaPct).toBeNull();
  });

  it("karyawan tanpa PT dikelompokkan sendiri, bukan dibuang", () => {
    const { byCompany } = aggregatePerformance([
      row({ employeeId: "a", score: 1 }),
      row({
        employeeId: "b",
        companyId: null,
        companyName: "Tanpa PT",
        branchId: null,
        branchName: "Tanpa cabang",
        score: 0.5,
      }),
    ]);

    expect(byCompany.map((c) => c.key).sort()).toEqual([NO_COMPANY, "c1"].sort());
    expect(byCompany.find((c) => c.key === NO_COMPANY)?.avgScore).toBe(0.5);
  });

  it("memisah jabatan yang sama di PT berbeda", () => {
    const { byRole, byRoleCompany } = aggregatePerformance([
      row({ employeeId: "a", roleName: "Kasir", companyId: "c1", score: 1 }),
      row({
        employeeId: "b",
        roleName: "Kasir",
        companyId: "c2",
        companyName: "PT Dua",
        score: 0.6,
      }),
    ]);

    expect(byRole).toHaveLength(1);
    expect(byRole[0].avgScore).toBeCloseTo(0.8);

    expect(byRoleCompany).toHaveLength(2);
    // Diurut dari yang terendah — yang perlu ditindaklanjuti di atas.
    expect(byRoleCompany[0].avgScore).toBe(0.6);
    expect(byRoleCompany[0].subLabel).toBe("PT Dua");
  });

  it("rata-rata riwayat mengabaikan bulan yang belum dinilai, bukan menganggapnya nol", () => {
    const { totals } = aggregatePerformance([
      row({ employeeId: "a", history: [1, null, 1] }),
      row({ employeeId: "b", history: [null, null, 0.5] }),
    ]);

    expect(totals.history[0]).toBe(1);
    expect(totals.history[1]).toBeNull();
    expect(totals.history[2]).toBeCloseTo(0.75);
  });

  it("KPI terlemah kelompok dirata-ratakan antar anggota", () => {
    const { byRole } = aggregatePerformance([
      row({
        employeeId: "a",
        kpis: [
          { name: "Kedisiplinan", achievement: 0.4 },
          { name: "Penjualan", achievement: 1.2 },
        ],
      }),
      row({
        employeeId: "b",
        kpis: [
          { name: "Kedisiplinan", achievement: 1 },
          { name: "Penjualan", achievement: 0.6 },
        ],
      }),
    ]);

    // Kedisiplinan rata-rata 0,7 vs Penjualan 0,9.
    expect(byRole[0].weakestKpi).toEqual({ name: "Kedisiplinan", achievement: 0.7 });
  });

  it("daftar kosong tidak menghasilkan NaN", () => {
    const { totals, byCompany, byRole } = aggregatePerformance([]);
    expect(totals.avgScore).toBeNull();
    expect(totals.history).toEqual([]);
    expect(byCompany).toEqual([]);
    expect(byRole).toEqual([]);
  });
});
