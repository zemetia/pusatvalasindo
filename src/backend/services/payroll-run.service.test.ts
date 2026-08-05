import { describe, expect, it } from "vitest";
import { computeTotals, summarize } from "./payroll-run.service";

type Entry = Parameters<typeof computeTotals>[0][number];

const entry = (overrides: Partial<Entry> & Pick<Entry, "type" | "amount">): Entry => ({
  status: "APPLIED",
  flag: null,
  ...overrides,
});

describe("computeTotals", () => {
  it("menjumlahkan bonus apa adanya dan denda/potongan sebagai nilai absolut", () => {
    const totals = computeTotals([
      entry({ type: "BONUS", amount: 100_000 }),
      entry({ type: "BONUS", amount: 50_000 }),
      entry({ type: "DENDA", amount: -30_000 }),
      entry({ type: "POTONGAN", amount: -20_000 }),
      entry({ type: "TUNJANGAN", amount: 10_000 }),
    ]);

    expect(totals.totalBonus).toBe(150_000);
    expect(totals.totalPenalty).toBe(30_000);
    expect(totals.totalDeduction).toBe(20_000);
    expect(totals.totalAllowance).toBe(10_000);
    expect(totals.needsReview).toBe(false);
  });

  it("mengabaikan entri yang tidak APPLIED dari total, tapi tetap menandai needsReview", () => {
    const totals = computeTotals([
      entry({ type: "BONUS", amount: 100_000, status: "SKIPPED" }),
      entry({ type: "BONUS", amount: 20_000 }),
    ]);

    expect(totals.totalBonus).toBe(20_000);
    expect(totals.needsReview).toBe(true);
  });

  it("menandai needsReview kalau ada entri APPLIED berflag, walau nominalnya normal", () => {
    const totals = computeTotals([entry({ type: "BONUS", amount: 20_000, flag: "butuh_review" })]);
    expect(totals.needsReview).toBe(true);
  });

  it("bonus manual dan potongan manual bertambah ke total yang sudah ada dari rule engine", () => {
    // Simulasi: entri dari rule engine (RULE/COMPONENT) digabung dengan satu
    // entri MANUAL — persis pola yang dipakai addManualEntry & recalculateSlip
    // untuk menggabungkan hasil rule terbaru dengan penyesuaian HR yang
    // dipertahankan.
    const ruleEntries = [entry({ type: "BONUS", amount: 200_000 })];
    const manualBonus = entry({ type: "BONUS", amount: 75_000 });

    const totals = computeTotals([...ruleEntries, manualBonus]);
    expect(totals.totalBonus).toBe(275_000);

    const manualPotongan = entry({ type: "POTONGAN", amount: -15_000 });
    const totalsWithDeduction = computeTotals([...ruleEntries, manualBonus, manualPotongan]);
    expect(totalsWithDeduction.totalDeduction).toBe(15_000);
    expect(totalsWithDeduction.totalBonus).toBe(275_000);
  });
});

describe("summarize", () => {
  const fakeCalc = (totalGrossFixed: number) =>
    ({
      components: {
        baseSalary: 3_000_000,
        mealAllowance: 300_000,
        transportAllowance: 200_000,
        positionAllowance: 0,
        bpjsKesehatan: 100_000,
        totalGrossFixed,
      },
    }) as Parameters<typeof summarize>[0];

  it("netPay = gaji kotor - potongan - denda + bonus", () => {
    const calc = fakeCalc(3_600_000);
    const entries = [
      { source: "RULE" as const, type: "BONUS" as const, status: "APPLIED" as const, label: "b", amount: 100_000 },
      { source: "RULE" as const, type: "DENDA" as const, status: "APPLIED" as const, label: "d", amount: -25_000 },
      { source: "COMPONENT" as const, type: "POTONGAN" as const, status: "APPLIED" as const, label: "p", amount: -10_000 },
    ];

    const summary = summarize(calc, entries);

    expect(summary.grossPay).toBe(3_600_000);
    expect(summary.totalBonus).toBe(100_000);
    expect(summary.totalPenalty).toBe(25_000);
    expect(summary.totalDeduction).toBe(10_000);
    expect(summary.netPay).toBe(3_600_000 - 25_000 - 10_000 + 100_000);
  });

  it("tidak menggandakan tunjangan komponen — grossPay dipakai apa adanya dari totalGrossFixed", () => {
    const calc = fakeCalc(3_800_000); // sudah termasuk tunjangan 200.000
    const entries = [
      {
        source: "COMPONENT" as const,
        type: "TUNJANGAN" as const,
        status: "APPLIED" as const,
        label: "pulsa",
        amount: 200_000,
      },
    ];

    const summary = summarize(calc, entries);
    expect(summary.grossPay).toBe(3_800_000);
    expect(summary.totalAllowance).toBe(200_000);
  });
});
