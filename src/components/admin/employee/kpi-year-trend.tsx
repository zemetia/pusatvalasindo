import { cn } from "@/lib/utils";

/**
 * Tren skor KPI 12 bulan. Grafik hanya mendukung angka — nilai utamanya
 * (rata-rata tahun berjalan) selalu dirender di header section pemanggil, sesuai
 * docs/blueprint/DATA_PRESENTATION.md §9: tanpa border, tanpa isian latar, garis
 * bantu hanya satu (batas 100% target).
 *
 * Warna batang mengikuti grade karena grade memang sebuah STATUS, bukan sekadar
 * seri data — token semantik yang sama dipakai `gradeClassName` di kpi-utils.
 */

const MONTH_SHORT = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const GRADE_BAR: Record<string, string> = {
  A: "bg-success",
  B: "bg-info",
  C: "bg-warning",
  D: "bg-destructive",
};

export type KpiTrendPoint = {
  month: number;
  /** Rasio pencapaian (1 = 100%). Null bila bulan itu belum dihitung. */
  score: number | null;
  grade: string | null;
};

export function KpiYearTrend({ points }: { points: KpiTrendPoint[] }) {
  const scores = points.map((p) => p.score).filter((s): s is number => s != null);
  // Skala minimal 120% supaya batas target selalu terlihat, dan tidak pernah
  // memotong pencapaian di atas plafon.
  const scaleMax = Math.max(1.2, ...scores);
  const targetLine = (1 / scaleMax) * 100;

  return (
    <div>
      <div className="relative h-32">
        <div
          className="border-border absolute inset-x-0 border-t border-dashed"
          style={{ bottom: `${targetLine}%` }}
          aria-hidden
        >
          <span className="text-muted-foreground absolute -top-4 right-0 text-[10px]">
            target 100%
          </span>
        </div>

        <div className="absolute inset-0 flex items-end gap-1.5">
          {points.map((point) => {
            const height = point.score == null ? 0 : (point.score / scaleMax) * 100;
            return (
              <div
                key={point.month}
                className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                title={
                  point.score == null
                    ? `${MONTH_SHORT[point.month]} — belum dihitung`
                    : `${MONTH_SHORT[point.month]} — ${(point.score * 100)
                        .toFixed(1)
                        .replace(".", ",")}% (grade ${point.grade ?? "—"})`
                }
              >
                {point.score != null && (
                  <span className="tabular text-muted-foreground text-center text-[10px] leading-none">
                    {Math.round(point.score * 100)}
                  </span>
                )}
                {point.score == null ? (
                  <div className="bg-border h-px w-full" />
                ) : (
                  <div
                    className={cn(
                      "w-full rounded-t-[3px]",
                      GRADE_BAR[point.grade ?? ""] ?? "bg-primary"
                    )}
                    style={{ height: `${Math.max(height, 1)}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        {points.map((point) => (
          <span
            key={point.month}
            className="text-muted-foreground min-w-0 flex-1 text-center text-[10px]"
          >
            {MONTH_SHORT[point.month]}
          </span>
        ))}
      </div>
    </div>
  );
}
