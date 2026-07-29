import { describe, it, expect } from "vitest";
import {
  scoreKpiItem,
  computeTotalScore,
  gradeFor,
  weekOfMonthFor,
  type KpiScoringConfig,
  type ScoringEntry,
  type ScoredKpiItem,
} from "./kpi-scoring";

/**
 * Kasus uji diambil langsung dari catatan aturan pada
 * docs/PVI Data/PUSAT KPI SEMUA_.xlsx supaya rumusnya tetap sesuai dengan yang
 * dipakai HR di lapangan.
 */

const baseConfig: KpiScoringConfig = {
  scoringType: "PENALTY_POINT",
  direction: "HIGHER_BETTER",
  weight: 1,
  targetValue: null,
  basePoint: 100,
  pointPerUnit: 1,
  toleranceLimit: null,
  toleranceScope: "DAILY",
  maxAchievement: 1.2,
  minAchievement: 0,
};

const cfg = (over: Partial<KpiScoringConfig>): KpiScoringConfig => ({ ...baseConfig, ...over });

const entry = (occurredAt: string, quantity: number, weekOfMonth = 1): ScoringEntry => ({
  occurredAt,
  weekOfMonth,
  quantity,
});

describe("TARGET_VALUE", () => {
  const target = cfg({ scoringType: "TARGET_VALUE", targetValue: 700_000_000 });

  it("membagi realisasi dengan target", () => {
    const result = scoreKpiItem(target, [
      entry("2026-07-02", 400_000_000),
      entry("2026-07-15", 350_000_000, 3),
    ]);
    expect(result.actual).toBe(750_000_000);
    expect(result.achievement).toBeCloseTo(750 / 700, 6);
  });

  it("dibatasi maxAchievement supaya satu KPI tidak menutupi KPI lain", () => {
    const result = scoreKpiItem(target, [entry("2026-07-02", 7_000_000_000)]);
    expect(result.achievement).toBe(1.2);
  });

  it("tanpa entri berarti belum tercapai", () => {
    const result = scoreKpiItem(target, []);
    expect(result.achievement).toBe(0);
    expect(result.noData).toBe(true);
  });

  it("LOWER_BETTER menilai realisasi kecil sebagai baik", () => {
    const risk = cfg({ scoringType: "TARGET_VALUE", direction: "LOWER_BETTER", targetValue: 10 });
    expect(scoreKpiItem(risk, [entry("2026-07-02", 10)]).achievement).toBe(1);
    expect(scoreKpiItem(risk, [entry("2026-07-02", 20)]).achievement).toBeCloseTo(0.5, 6);
  });

  it("target belum disetel tidak menghasilkan Infinity", () => {
    const result = scoreKpiItem(cfg({ scoringType: "TARGET_VALUE", targetValue: null }), [
      entry("2026-07-02", 100),
    ]);
    expect(result.achievement).toBe(0);
  });
});

describe("PENALTY_POINT", () => {
  // "Tingkat Ketelitian Perhitungan — -3 point setiap kali ada kesalahan"
  const teliti = cfg({ scoringType: "PENALTY_POINT", basePoint: 100, pointPerUnit: 3 });

  it("mengurangi poin per kejadian, bukan per satuan quantity mentah", () => {
    const result = scoreKpiItem(teliti, [entry("2026-07-03", 2), entry("2026-07-10", 1, 2)]);
    // 3 kejadian × 3 poin = 9 poin dari 100
    expect(result.actual).toBe(9);
    expect(result.achievement).toBeCloseTo(0.91, 6);
  });

  it("tanpa pelanggaran bernilai penuh", () => {
    expect(scoreKpiItem(teliti, []).achievement).toBe(1);
  });

  it("tidak pernah negatif karena dibatasi minAchievement", () => {
    const result = scoreKpiItem(teliti, [entry("2026-07-03", 50)]);
    expect(result.achievement).toBe(0);
  });
});

describe("REWARD_POINT", () => {
  // "1 google review +2 point, target 50 point"
  const review = cfg({ scoringType: "REWARD_POINT", pointPerUnit: 2, targetValue: 50 });

  it("mengakumulasi poin menuju target", () => {
    const result = scoreKpiItem(review, [entry("2026-07-05", 10), entry("2026-07-20", 5, 3)]);
    // 15 review × 2 poin = 30 dari 50
    expect(result.actual).toBe(30);
    expect(result.achievement).toBeCloseTo(0.6, 6);
  });

  it("melampaui target tetap dibatasi plafon", () => {
    expect(scoreKpiItem(review, [entry("2026-07-05", 100)]).achievement).toBe(1.2);
  });
});

describe("PENALTY_PERCENT", () => {
  // "kurs updating — -5% setiap kali telat update"
  const kurs = cfg({ scoringType: "PENALTY_PERCENT", pointPerUnit: 5 });

  it("memotong persen per kejadian", () => {
    expect(scoreKpiItem(kurs, [entry("2026-07-04", 3)]).achievement).toBeCloseTo(0.85, 6);
  });

  it("tanpa keterlambatan bernilai penuh", () => {
    expect(scoreKpiItem(kurs, []).achievement).toBe(1);
  });
});

describe("TOLERANCE_LIMIT", () => {
  // "selisih kas maksimal 100rb per hari, di atas itu -4 point"
  const kas = cfg({
    scoringType: "TOLERANCE_LIMIT",
    basePoint: 100,
    pointPerUnit: 4,
    toleranceLimit: 100_000,
    toleranceScope: "DAILY",
  });

  it("selisih di bawah batas tidak kena penalti", () => {
    const result = scoreKpiItem(kas, [entry("2026-07-03", 80_000)]);
    expect(result.achievement).toBe(1);
  });

  it("menjumlahkan selisih dalam satu hari sebelum membandingkan batas", () => {
    // 60rb + 60rb di hari yang sama = 120rb → satu pelanggaran, bukan nol
    const result = scoreKpiItem(kas, [entry("2026-07-03", 60_000), entry("2026-07-03", 60_000)]);
    expect(result.actual).toBe(4);
    expect(result.achievement).toBeCloseTo(0.96, 6);
  });

  it("menghitung pelanggaran per hari, bukan per entri", () => {
    const result = scoreKpiItem(kas, [
      entry("2026-07-03", 150_000),
      entry("2026-07-04", 200_000),
      entry("2026-07-05", 10_000),
    ]);
    // 2 hari melanggar × 4 poin
    expect(result.actual).toBe(8);
    expect(result.achievement).toBeCloseTo(0.92, 6);
  });

  it("cakupan bulanan menjumlahkan seluruh periode", () => {
    const monthly = cfg({ ...kas, toleranceScope: "MONTHLY" });
    const result = scoreKpiItem(monthly, [
      entry("2026-07-03", 60_000),
      entry("2026-07-10", 60_000, 2),
    ]);
    expect(result.actual).toBe(4);
  });
});

describe("BOOLEAN_DAILY", () => {
  const checklist = cfg({ scoringType: "BOOLEAN_DAILY" });

  it("menghitung rasio hari patuh", () => {
    const result = scoreKpiItem(checklist, [
      entry("2026-07-01", 1),
      entry("2026-07-02", 1),
      entry("2026-07-03", 0),
      entry("2026-07-04", 1),
    ]);
    expect(result.achievement).toBeCloseTo(0.75, 6);
  });

  it("satu catatan tidak patuh menggugurkan harinya", () => {
    const result = scoreKpiItem(checklist, [entry("2026-07-01", 1), entry("2026-07-01", 0)]);
    expect(result.achievement).toBe(0);
  });
});

describe("rincian mingguan", () => {
  it("menjumlahkan quantity ke kolom minggu 1-4 seperti pada sheet", () => {
    const result = scoreKpiItem(cfg({ scoringType: "TARGET_VALUE", targetValue: 100 }), [
      entry("2026-07-02", 10, 1),
      entry("2026-07-09", 20, 2),
      entry("2026-07-16", 30, 3),
      entry("2026-07-23", 40, 4),
    ]);
    expect(result.weeklyTotals).toEqual([10, 20, 30, 40, 0]);
  });

  it("minggu di luar 1-5 tetap masuk ember terdekat", () => {
    const result = scoreKpiItem(cfg({ scoringType: "TARGET_VALUE", targetValue: 100 }), [
      entry("2026-07-31", 5, 9),
    ]);
    expect(result.weeklyTotals).toEqual([0, 0, 0, 0, 5]);
  });
});

describe("computeTotalScore", () => {
  const item = (weight: number, achievement: number): ScoredKpiItem => ({
    roleKpiId: `rk-${weight}-${achievement}`,
    kpiId: "kpi",
    kpiCode: "kpi",
    kpiName: "KPI",
    scoringType: "TARGET_VALUE",
    unit: "OCCURRENCE",
    inputSource: "SUPERVISOR",
    weight,
    achievement,
    weightedScore: achievement * weight,
    actual: 0,
    reference: 0,
    weeklyTotals: [0, 0, 0, 0, 0],
    entryCount: 0,
    noData: false,
    explanation: "",
  });

  it("mengalikan bobot sekali saja", () => {
    // Bug lama: skor dikali bobot dua kali sehingga 0.3 × 0.3 = 0.09.
    const result = computeTotalScore([item(0.3, 1), item(0.7, 1)]);
    expect(result.totalScore).toBeCloseTo(1, 6);
  });

  it("menghitung rata-rata tertimbang yang benar", () => {
    const result = computeTotalScore([item(0.4, 1), item(0.6, 0.5)]);
    expect(result.totalScore).toBeCloseTo(0.7, 6);
  });

  it("menormalkan ketika total bobot bukan 1", () => {
    const result = computeTotalScore([item(0.3, 1), item(0.3, 1)]);
    expect(result.totalScore).toBeCloseTo(1, 6);
    expect(result.weightSum).toBeCloseTo(0.6, 6);
  });

  it("tanpa KPI bernilai 0 dan tidak NaN", () => {
    const result = computeTotalScore([]);
    expect(result.totalScore).toBe(0);
    expect(result.grade).toBe("D");
  });
});

describe("gradeFor", () => {
  it("memetakan skor ke huruf", () => {
    expect(gradeFor(0.95)).toBe("A");
    expect(gradeFor(0.9)).toBe("A");
    expect(gradeFor(0.8)).toBe("B");
    expect(gradeFor(0.6)).toBe("C");
    expect(gradeFor(0.59)).toBe("D");
  });
});

describe("weekOfMonthFor", () => {
  it("membagi bulan per 7 hari, dibaca di UTC seperti kolom @db.Date", () => {
    expect(weekOfMonthFor(new Date(Date.UTC(2026, 6, 1)))).toBe(1);
    expect(weekOfMonthFor(new Date(Date.UTC(2026, 6, 7)))).toBe(1);
    expect(weekOfMonthFor(new Date(Date.UTC(2026, 6, 8)))).toBe(2);
    expect(weekOfMonthFor(new Date(Date.UTC(2026, 6, 29)))).toBe(5);
  });
});
