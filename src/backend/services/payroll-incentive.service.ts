import prisma from "@/lib/prisma";
import { payrollIncentiveRepository } from "@/backend/repositories/payroll-incentive.repository";
import type { PayrollIncentiveOutcome } from "@src/generated/prisma/client";

/**
 * Mengubah skor KPI menjadi angka rupiah.
 *
 * Sengaja terpisah dari kpi.service: modul KPI hanya menilai kinerja, dan tidak
 * boleh ikut menghitung denda/bonus. Aturan matriksnya berasal dari sheet
 * "MATRIX BONUS" di docs/PVI Data/PERHITUNGAN KOMISI KPI_.xlsx, mis.
 * "80%-100% → 250.000", "60%-79% → safe zone", "10%-60% → potong 150rb +
 * setiap Sabtu wajib masuk", "di atas 120% → 1.500.000".
 */

export type IncentiveResult = {
  /** Rasio pencapaian KPI (1 = 100%). Null bila KPI periode itu belum dihitung. */
  score: number | null;
  grade: string | null;
  /** Tier reguler yang cocok, bila ada. */
  outcome: PayrollIncentiveOutcome | null;
  outcomeLabel: string;
  /** Nominal tier reguler, positif untuk bonus dan negatif untuk potongan. */
  tierAmount: number;
  /** Bonus tambahan peringkat teratas, selalu positif. */
  topPerformerBonus: number;
  /** Peringkat di jabatan & PT yang sama pada periode ini (1 = tertinggi). */
  rank: number | null;
  peerCount: number;
  /** Sanksi non-uang yang menyertai tier. */
  mandatorySaturday: boolean;
  /** Efek bersih ke gaji: tierAmount + topPerformerBonus. */
  netAmount: number;
  /** Kenapa hasilnya begitu — ditampilkan di slip dan halaman payroll. */
  reason: string;
};

const OUTCOME_LABELS: Record<PayrollIncentiveOutcome, string> = {
  BONUS_CASH: "Bonus Cash",
  SAFE_ZONE: "Aman (tanpa bonus/potongan)",
  DEDUCTION: "Potongan Gaji",
  TOP_PERFORMER: "Top Performer",
};

const EMPTY: IncentiveResult = {
  score: null,
  grade: null,
  outcome: null,
  outcomeLabel: "Belum ada hasil KPI",
  tierAmount: 0,
  topPerformerBonus: 0,
  rank: null,
  peerCount: 0,
  mandatorySaturday: false,
  netAmount: 0,
  reason: "KPI periode ini belum dihitung",
};

function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const payrollIncentiveService = {
  /**
   * Hitung insentif KPI seorang karyawan untuk satu periode.
   *
   * Peringkat top performer dihitung terhadap rekan sejabatan di PT yang sama,
   * jadi tidak bisa disimpan per baris — harus dihitung saat dibutuhkan.
   */
  resolveForEmployee: async (
    employeeId: string,
    month: number,
    year: number
  ): Promise<IncentiveResult> => {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { customRoleId: true, branch: { select: { companyId: true } } },
    });

    const companyId = employee?.branch?.companyId ?? null;
    const customRoleId = employee?.customRoleId ?? null;
    if (!companyId || !customRoleId) return EMPTY;

    const [result, matrix] = await Promise.all([
      prisma.kpiMonthlyResult.findUnique({
        where: { employeeId_month_year: { employeeId, month, year } },
        select: { totalScore: true, grade: true },
      }),
      payrollIncentiveRepository.findByCompanyRole(companyId, customRoleId),
    ]);

    if (!result) return EMPTY;

    const score = Number(result.totalScore);
    const grade = result.grade;

    if (!matrix || !matrix.isActive || matrix.tiers.length === 0) {
      return {
        ...EMPTY,
        score,
        grade,
        outcomeLabel: "Matriks insentif belum disetel",
        reason: "Belum ada matriks insentif untuk jabatan ini",
      };
    }

    // Tier sudah terurut minScore menurun, jadi rentang tertinggi (mis. >120%)
    // menang lebih dulu ketika beberapa rentang bertumpang tindih.
    const regularTier = matrix.tiers.find(
      (t) =>
        t.outcome !== "TOP_PERFORMER" &&
        score >= Number(t.minScore) &&
        score <= Number(t.maxScore)
    );

    const cash = regularTier ? Number(regularTier.cashAmount ?? 0) : 0;
    const tierAmount =
      regularTier?.outcome === "BONUS_CASH"
        ? cash
        : regularTier?.outcome === "DEDUCTION"
          ? -cash
          : 0;

    // ── Bonus peringkat ──
    const topTier = matrix.tiers.find((t) => t.outcome === "TOP_PERFORMER");
    let rank: number | null = null;
    let peerCount = 0;
    let topPerformerBonus = 0;

    if (topTier) {
      const peers = await prisma.kpiMonthlyResult.findMany({
        where: {
          month,
          year,
          employee: {
            isActive: true,
            customRoleId,
            branch: { companyId },
          },
        },
        select: { employeeId: true, totalScore: true },
        orderBy: { totalScore: "desc" },
      });

      peerCount = peers.length;
      const index = peers.findIndex((p) => p.employeeId === employeeId);
      rank = index >= 0 ? index + 1 : null;

      if (rank !== null && rank <= (topTier.topRank ?? 1)) {
        topPerformerBonus = Number(topTier.cashAmount ?? 0);
      }
    }

    const netAmount = tierAmount + topPerformerBonus;
    const outcome = regularTier?.outcome ?? null;

    const reasonParts: string[] = [`Skor KPI ${(score * 100).toFixed(1)}% (grade ${grade})`];
    if (regularTier) {
      const range = `${(Number(regularTier.minScore) * 100).toFixed(0)}%–${(Number(regularTier.maxScore) * 100).toFixed(0)}%`;
      reasonParts.push(
        outcome === "SAFE_ZONE"
          ? `masuk rentang ${range}: aman, tanpa bonus maupun potongan`
          : `masuk rentang ${range}: ${OUTCOME_LABELS[outcome!].toLowerCase()} ${formatIdr(cash)}`
      );
    } else {
      reasonParts.push("tidak masuk rentang tier mana pun");
    }
    if (regularTier?.mandatorySaturday) {
      reasonParts.push("wajib masuk setiap Sabtu");
    }
    if (topPerformerBonus > 0) {
      reasonParts.push(`peringkat ${rank} dari ${peerCount}: bonus ${formatIdr(topPerformerBonus)}`);
    }

    return {
      score,
      grade,
      outcome,
      outcomeLabel: outcome ? OUTCOME_LABELS[outcome] : "Di luar rentang tier",
      tierAmount,
      topPerformerBonus,
      rank,
      peerCount,
      mandatorySaturday: regularTier?.mandatorySaturday ?? false,
      netAmount,
      reason: reasonParts.join(" — "),
    };
  },
};
