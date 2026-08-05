/**
 * Mesin penilaian KPI — murni, tanpa akses database, supaya bisa diuji sendiri.
 *
 * Aturannya diambil dari catatan pada sheet KPI perusahaan
 * (docs/PVI Data/PUSAT KPI SEMUA_.xlsx), mis. "-3 point setiap kali ada
 * kesalahan", "1 google review +2 point target 50 point", "-5% setiap kali
 * telat update kurs", "selisih kas maksimal 100rb per hari, di atas itu -4 point".
 *
 * Konvensi angka: SEMUA hasil dinyatakan sebagai *rasio pencapaian* di mana
 * 1 = 100% target. Bobot dikalikan sekali saja di computeTotalScore — engine
 * lama mengalikannya dua kali sehingga skor selalu jauh di bawah semestinya.
 */

import type {
  KpiDirection,
  KpiScoringType,
  KpiToleranceScope,
} from "@src/generated/prisma/client";

/** Parameter penilaian satu KPI untuk satu jabatan (berasal dari RoleKpi). */
export type KpiScoringConfig = {
  scoringType: KpiScoringType;
  direction: KpiDirection;
  /** Bobot 0..1 terhadap total skor jabatan. */
  weight: number;
  targetValue: number | null;
  basePoint: number | null;
  pointPerUnit: number | null;
  toleranceLimit: number | null;
  toleranceScope: KpiToleranceScope | null;
};

/** Satu entri KPI yang sudah disetujui, dipakai sebagai bahan perhitungan. */
export type ScoringEntry = {
  /** Tanggal kejadian dalam format YYYY-MM-DD (dipakai mengelompokkan harian). */
  occurredAt: string;
  /** 1..5, mengikuti kolom "week 1-4" pada sheet KPI. */
  weekOfMonth: number;
  quantity: number;
};

export type KpiItemScore = {
  /** Rasio pencapaian apa adanya, tanpa plafon maupun lantai. 1 = 100%. */
  achievement: number;
  /** Kontribusi ke skor akhir: achievement × weight. */
  weightedScore: number;
  /** Angka mentah yang dirangkum (total omzet, total poin penalti, dst). */
  actual: number;
  /** Nilai pembanding: target, poin awal, atau jumlah hari — sesuai tipe. */
  reference: number;
  /** Total quantity per minggu ke-1..5, meniru kolom mingguan pada sheet. */
  weeklyTotals: number[];
  entryCount: number;
  /** Tidak ada satu pun entri pada periode ini. */
  noData: boolean;
  /** Ringkasan aturan yang dipakai, untuk ditampilkan di rincian. */
  explanation: string;
};

const EMPTY_WEEKS = () => [0, 0, 0, 0, 0];

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function sum(entries: ScoringEntry[]) {
  return entries.reduce((total, e) => total + e.quantity, 0);
}

function weeklyTotals(entries: ScoringEntry[]) {
  const weeks = EMPTY_WEEKS();
  for (const e of entries) {
    const idx = clamp(Math.trunc(e.weekOfMonth), 1, 5) - 1;
    weeks[idx] += e.quantity;
  }
  return weeks;
}

/** Kunci pengelompokan untuk TOLERANCE_LIMIT sesuai cakupan toleransinya. */
function toleranceBucketKey(entry: ScoringEntry, scope: KpiToleranceScope) {
  if (scope === "DAILY") return entry.occurredAt;
  if (scope === "WEEKLY") return `w${entry.weekOfMonth}`;
  return "month";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

/**
 * Hitung pencapaian satu KPI dari entri-entri yang sudah disetujui.
 *
 * KPI yang nilainya *dikumpulkan* (target, reward, checklist) dimulai dari 0 —
 * tanpa data berarti belum tercapai. KPI yang nilainya *dikurangi* (penalti,
 * toleransi) dimulai dari penuh — tanpa data berarti tidak ada pelanggaran.
 */
export function scoreKpiItem(
  config: KpiScoringConfig,
  entries: ScoringEntry[]
): KpiItemScore {
  const weeks = weeklyTotals(entries);
  const noData = entries.length === 0;

  const finish = (
    achievement: number,
    actual: number,
    reference: number,
    explanation: string
  ): KpiItemScore => {
    // Tidak ada plafon maupun lantai: 150% tetap 150%, penalti berlebih tetap
    // negatif. Satu-satunya pengaman adalah pembagian nol/NaN, yang tidak bisa
    // disimpan sebagai Decimal.
    const value = Number.isFinite(achievement) ? achievement : 0;
    return {
      achievement: value,
      weightedScore: value * config.weight,
      actual,
      reference,
      weeklyTotals: weeks,
      entryCount: entries.length,
      noData,
      explanation,
    };
  };

  switch (config.scoringType) {
    case "TARGET_VALUE": {
      const target = config.targetValue ?? 0;
      const actual = sum(entries);
      if (target <= 0) {
        return finish(0, actual, 0, "Target belum disetel — pencapaian tidak dapat dihitung");
      }
      if (config.direction === "LOWER_BETTER") {
        // Makin kecil makin baik (mis. tingkat resiko): tepat di batas = 100%,
        // nihil = 200%, dua kali batas = 0%, lebih dari itu negatif. Bentuk
        // selisih dipakai — bukan target/actual — karena tanpa plafon rasio
        // meledak tak terhingga saat realisasi mendekati nol.
        return finish(
          2 - actual / target,
          actual,
          target,
          `Realisasi ${formatNumber(actual)} terhadap batas ${formatNumber(target)} (makin kecil makin baik)`
        );
      }
      return finish(
        actual / target,
        actual,
        target,
        `Realisasi ${formatNumber(actual)} dari target ${formatNumber(target)}`
      );
    }

    case "PENALTY_POINT": {
      const base = config.basePoint ?? 100;
      const perUnit = config.pointPerUnit ?? 1;
      const occurrences = sum(entries);
      const penalty = occurrences * perUnit;
      if (base <= 0) {
        return finish(0, penalty, 0, "Poin awal belum disetel — pencapaian tidak dapat dihitung");
      }
      return finish(
        (base - penalty) / base,
        penalty,
        base,
        `${formatNumber(occurrences)} kejadian × ${formatNumber(perUnit)} poin = −${formatNumber(penalty)} dari ${formatNumber(base)} poin`
      );
    }

    case "REWARD_POINT": {
      const target = config.targetValue ?? 0;
      const perUnit = config.pointPerUnit ?? 1;
      const occurrences = sum(entries);
      const earned = occurrences * perUnit;
      if (target <= 0) {
        return finish(0, earned, 0, "Target poin belum disetel — pencapaian tidak dapat dihitung");
      }
      return finish(
        earned / target,
        earned,
        target,
        `${formatNumber(occurrences)} kejadian × ${formatNumber(perUnit)} poin = ${formatNumber(earned)} dari target ${formatNumber(target)} poin`
      );
    }

    case "PENALTY_PERCENT": {
      // pointPerUnit di sini berarti persen, mis. 5 untuk "-5% setiap kejadian".
      const perUnit = config.pointPerUnit ?? 0;
      const occurrences = sum(entries);
      const deduction = (occurrences * perUnit) / 100;
      return finish(
        1 - deduction,
        occurrences * perUnit,
        100,
        `${formatNumber(occurrences)} kejadian × ${formatNumber(perUnit)}% = −${formatNumber(occurrences * perUnit)}% dari 100%`
      );
    }

    case "TOLERANCE_LIMIT": {
      const base = config.basePoint ?? 100;
      const perUnit = config.pointPerUnit ?? 1;
      const limit = config.toleranceLimit ?? 0;
      const scope = config.toleranceScope ?? "DAILY";

      // Kelebihan dihitung per hari/minggu/bulan, bukan per entri: dua selisih
      // 60rb di hari yang sama tetap melewati batas 100rb sekali, bukan nol kali.
      const buckets = new Map<string, number>();
      for (const entry of entries) {
        const key = toleranceBucketKey(entry, scope);
        buckets.set(key, (buckets.get(key) ?? 0) + entry.quantity);
      }
      const violations = [...buckets.values()].filter((total) => total > limit).length;
      const penalty = violations * perUnit;
      if (base <= 0) {
        return finish(0, penalty, 0, "Poin awal belum disetel — pencapaian tidak dapat dihitung");
      }

      const scopeLabel = scope === "DAILY" ? "hari" : scope === "WEEKLY" ? "minggu" : "bulan";
      return finish(
        (base - penalty) / base,
        penalty,
        base,
        `${violations} ${scopeLabel} melewati batas ${formatNumber(limit)} × ${formatNumber(perUnit)} poin = −${formatNumber(penalty)} dari ${formatNumber(base)} poin`
      );
    }

    case "BOOLEAN_DAILY": {
      // Satu entri = satu hari; quantity ≥ 1 berarti patuh.
      const perDay = new Map<string, boolean>();
      for (const entry of entries) {
        const compliant = entry.quantity >= 1;
        perDay.set(entry.occurredAt, (perDay.get(entry.occurredAt) ?? true) && compliant);
      }
      const totalDays = perDay.size;
      const compliantDays = [...perDay.values()].filter(Boolean).length;
      if (totalDays === 0) {
        return finish(0, 0, 0, "Belum ada hari yang dinilai");
      }
      return finish(
        compliantDays / totalDays,
        compliantDays,
        totalDays,
        `${compliantDays} dari ${totalDays} hari sesuai checklist`
      );
    }

    default: {
      // Tipe baru yang belum punya rumus tidak boleh diam-diam bernilai 0.
      const exhaustive: never = config.scoringType;
      throw new Error(`Tipe penilaian KPI belum didukung: ${String(exhaustive)}`);
    }
  }
}

export type ScoredKpiItem = KpiItemScore & {
  roleKpiId: string;
  kpiId: string;
  kpiCode: string;
  kpiName: string;
  scoringType: KpiScoringType;
  unit: string;
  weight: number;
  inputSource: string;
};

export type MonthlyScore = {
  /** Rasio tertimbang; 1 = seluruh target tercapai. */
  totalScore: number;
  grade: "A" | "B" | "C" | "D";
  /** Jumlah bobot seluruh KPI aktif. Idealnya 1 — UI memperingatkan jika bukan. */
  weightSum: number;
  items: ScoredKpiItem[];
};

const GRADE_THRESHOLDS = [
  { min: 0.9, grade: "A" as const },
  { min: 0.75, grade: "B" as const },
  { min: 0.6, grade: "C" as const },
];

export function gradeFor(totalScore: number): "A" | "B" | "C" | "D" {
  return GRADE_THRESHOLDS.find((t) => totalScore >= t.min)?.grade ?? "D";
}

/**
 * Gabungkan nilai per KPI menjadi skor bulanan.
 *
 * Dibagi total bobot, bukan diasumsikan berjumlah 1: kalau admin menyetel
 * bobot yang totalnya 0.9, karyawan tidak ikut kehilangan 10% skor. `weightSum`
 * tetap dikembalikan supaya konfigurasi yang tidak rapi bisa ditampilkan.
 */
export function computeTotalScore(items: ScoredKpiItem[]): MonthlyScore {
  const weightSum = items.reduce((total, item) => total + item.weight, 0);
  const weighted = items.reduce((total, item) => total + item.weightedScore, 0);
  const totalScore = weightSum > 0 ? weighted / weightSum : 0;

  return {
    totalScore,
    grade: gradeFor(totalScore),
    weightSum,
    items,
  };
}

/**
 * Minggu ke berapa dalam bulan (1..5) — dipakai saat menyimpan entri.
 *
 * Dibaca di UTC karena tanggal kejadian bertipe `@db.Date` dan seluruh modul
 * memperlakukan kolom itu di UTC (lihat src/lib/finance-period.ts). Memakai
 * pembacaan lokal membuat hasilnya berbeda antara server WIB dan server UTC.
 */
export function weekOfMonthFor(date: Date): number {
  return Math.floor((date.getUTCDate() - 1) / 7) + 1;
}
