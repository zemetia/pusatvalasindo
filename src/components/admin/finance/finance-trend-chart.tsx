import { formatCompactIdr, formatDate, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TrendPoint = {
  date: string;
  value: number | null;
  /** Hari dengan konfirmasi sendiri; sisanya saldo yang dibawa maju. */
  confirmed: boolean;
};

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 180;

/**
 * Tren posisi aset harian — SVG yang dirender di server, tanpa library chart.
 *
 * Mengikuti `DATA_PRESENTATION.md` §9: tanpa border, tanpa background, tanpa
 * bingkai; hanya gridline horizontal; deret fokus berwarna `primary` dan
 * pembanding (posisi awal periode) `muted-foreground`. Angka utamanya hidup di
 * header section, bukan di dalam chart.
 *
 * Chart diregangkan (`preserveAspectRatio="none"`) supaya selalu memenuhi lebar
 * kolom, jadi tiap garis memakai `vector-effect="non-scaling-stroke"` agar
 * ketebalannya tidak ikut teregang. Konsekuensinya bentuk-bentuk berisi ikut
 * gepeng — karena itu penanda hari terkonfirmasi berupa garis tegak (rug) di
 * dasar chart, bukan titik bulat.
 */
export function FinanceTrendChart({
  points,
  baseline,
  className,
}: {
  points: TrendPoint[];
  /** Posisi awal periode — garis putus-putus sebagai titik nol pembanding. */
  baseline?: number | null;
  className?: string;
}) {
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value != null);

  if (values.length < 2) {
    return (
      <p className={cn("text-muted-foreground py-8 text-sm", className)}>
        Belum cukup hari terkonfirmasi untuk menggambar tren pada periode ini.
      </p>
    );
  }

  const candidates = baseline == null ? values : [...values, baseline];
  const rawMin = Math.min(...candidates);
  const rawMax = Math.max(...candidates);
  // Domain diberi napas 4% supaya garis tidak menempel tepi; deret datar tetap
  // mendapat tinggi supaya tidak jatuh jadi garis di dasar chart.
  const pad = rawMax === rawMin ? Math.abs(rawMax || 1) * 0.05 : (rawMax - rawMin) * 0.04;
  const min = rawMin - pad;
  const max = rawMax + pad;

  const stepX = points.length > 1 ? VIEW_WIDTH / (points.length - 1) : VIEW_WIDTH;
  const x = (index: number) => index * stepX;
  const y = (value: number) => VIEW_HEIGHT - ((value - min) / (max - min)) * VIEW_HEIGHT;

  // Garis diputus saat ada tanggal tanpa nilai sama sekali (belum pernah ada
  // konfirmasi sampai tanggal itu) — lubang data tidak boleh dilompati.
  const segments: { index: number; value: number }[][] = [];
  let run: { index: number; value: number }[] = [];
  points.forEach((point, index) => {
    if (point.value == null) {
      if (run.length > 0) segments.push(run);
      run = [];
      return;
    }
    run.push({ index, value: point.value });
  });
  if (run.length > 0) segments.push(run);

  const toPath = (segment: { index: number; value: number }[]) =>
    segment.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.index)},${y(p.value)}`).join(" ");

  const toArea = (segment: { index: number; value: number }[]) => {
    const first = segment[0];
    const last = segment[segment.length - 1];
    return `${toPath(segment)} L${x(last.index)},${VIEW_HEIGHT} L${x(first.index)},${VIEW_HEIGHT} Z`;
  };

  const firstDate = points[0]?.date;
  const lastDate = points[points.length - 1]?.date;
  const midDate = points[Math.floor((points.length - 1) / 2)]?.date;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label={`Tren posisi aset ${formatDate(firstDate)} sampai ${formatDate(lastDate)}, terendah Rp ${formatCompactIdr(rawMin)}, tertinggi Rp ${formatCompactIdr(rawMax)}`}
      >
        <g
          className="text-border"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        >
          {[0, 0.5, 1].map((ratio) => (
            <line
              key={ratio}
              x1={0}
              x2={VIEW_WIDTH}
              y1={ratio * VIEW_HEIGHT}
              y2={ratio * VIEW_HEIGHT}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {segments.map((segment, index) => (
          <path
            key={`area-${index}`}
            d={toArea(segment)}
            className="text-primary/10"
            fill="currentColor"
          />
        ))}

        {baseline != null && (
          <line
            x1={0}
            x2={VIEW_WIDTH}
            y1={y(baseline)}
            y2={y(baseline)}
            className="text-muted-foreground/60"
            stroke="currentColor"
            strokeDasharray="5 5"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {segments.map((segment, index) => (
          <path
            key={`line-${index}`}
            d={toPath(segment)}
            className="text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Rug: satu garis tegak pendek per hari yang benar-benar dikonfirmasi. */}
        <g className="text-primary/50" stroke="currentColor" strokeWidth="1">
          {points.map((point, index) =>
            point.confirmed ? (
              <line
                key={point.date}
                x1={x(index)}
                x2={x(index)}
                y1={VIEW_HEIGHT - 6}
                y2={VIEW_HEIGHT}
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
        </g>
      </svg>

      <div className="text-muted-foreground pointer-events-none absolute top-0 right-0 text-xs">
        <span className="tabular">{formatCompactIdr(rawMax)}</span>
      </div>

      <div className="text-muted-foreground mt-2 flex items-baseline justify-between text-xs">
        <span className="tabular">{formatDateShort(firstDate)}</span>
        {points.length > 2 && <span className="tabular">{formatDateShort(midDate)}</span>}
        <span className="tabular">{formatDateShort(lastDate)}</span>
      </div>
    </div>
  );
}
