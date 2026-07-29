import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { monthGrid, WEEKDAY_LABELS, type PeriodRange } from "@/lib/finance-period";
import { formatCompactIdr, formatMonth } from "@/lib/format";
import type { FinanceSeriesPoint } from "@/backend/services/finance-report.service";
import { cn } from "@/lib/utils";

/**
 * Kalender keuangan: posisi aset konsolidasi per hari dalam satu bulan.
 *
 * Ini permukaan analisis, bukan date picker — tiap sel menampilkan saldo akhir
 * hari plus perubahannya terhadap hari sebelumnya, dan mengklik sel menyetel
 * periode laporan ke hari itu. Hari di luar periode terpilih tetap dirender
 * (diredupkan) supaya bentuk bulannya utuh dan konteks sebelum/sesudah periode
 * tidak hilang.
 *
 * Selnya dipisah garis rambut, bukan kartu — lihat `DATA_PRESENTATION.md` §8.
 */
export function FinanceCalendar({
  month,
  series,
  range,
  today,
  prevHref,
  nextHref,
  dayHref,
}: {
  month: string;
  /** Deret penuh (periode pembanding + periode terpilih). */
  series: FinanceSeriesPoint[];
  range: PeriodRange;
  today: string;
  prevHref: string | null;
  nextHref: string | null;
  dayHref: (date: string) => string;
}) {
  const byDate = new Map(series.map((point) => [point.date, point]));
  // Perubahan harian dihitung dari deret, bukan dari sel tetangga di grid —
  // hari pertama sebuah pekan tetap dibandingkan dengan hari sebelumnya.
  const changeByDate = new Map<string, number | null>();
  series.forEach((point, index) => {
    const previous = index > 0 ? series[index - 1] : undefined;
    changeByDate.set(
      point.date,
      previous?.total == null || point.total == null ? null : point.total - previous.total,
    );
  });

  const weeks = monthGrid(month);

  return (
    <div>
      <header className="mb-4 flex items-center justify-between gap-3">
        {/* h3: judul section "Kalender Keuangan" di atasnya sudah h2. */}
        <h3 className="text-sm font-semibold tracking-tight">{formatMonth(month)}</h3>
        <div className="flex items-center gap-1">
          <MonthNav href={prevHref} label="Bulan sebelumnya">
            <IconChevronLeft className="size-4" aria-hidden />
          </MonthNav>
          <MonthNav href={nextHref} label="Bulan berikutnya">
            <IconChevronRight className="size-4" aria-hidden />
          </MonthNav>
        </div>
      </header>

      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-muted-foreground pb-2 text-center text-xs font-medium tracking-wide uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="border-border grid grid-cols-7 border-t border-l">
        {weeks.flat().map((date, index) => {
          if (!date) {
            return (
              <div
                key={`empty-${index}`}
                className="border-border bg-muted/20 min-h-20 border-r border-b"
              />
            );
          }

          const point = byDate.get(date);
          const change = changeByDate.get(date) ?? null;
          const inPeriod = date >= range.from && date <= range.to;
          const isToday = date === today;
          const dayNumber = Number(date.slice(8, 10));

          const content = (
            <>
              <div className="flex items-baseline justify-between gap-1">
                <span
                  className={cn(
                    "tabular text-xs",
                    isToday
                      ? "text-foreground font-semibold"
                      : inPeriod
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50",
                  )}
                >
                  {dayNumber}
                </span>
                {point?.confirmed && (
                  <span
                    className="bg-primary size-1.5 rounded-full"
                    title="Ada konfirmasi kepala cabang hari ini"
                    aria-label="terkonfirmasi"
                  />
                )}
              </div>

              <p
                className={cn(
                  "tabular mt-1.5 truncate text-sm font-medium",
                  point?.total == null && "text-muted-foreground/50",
                  point?.total != null && !inPeriod && "text-muted-foreground/60",
                  point?.total != null && inPeriod && !point.confirmed && "text-muted-foreground",
                  point?.total != null && inPeriod && point.confirmed && "text-foreground",
                )}
              >
                {formatCompactIdr(point?.total ?? null)}
              </p>

              {change != null && Math.abs(change) > 0.5 && (
                <p
                  className={cn(
                    "tabular mt-0.5 truncate text-[11px]",
                    change > 0 ? "text-success" : "text-destructive",
                    !inPeriod && "opacity-60",
                  )}
                >
                  {change > 0 ? "+" : "−"}
                  {formatCompactIdr(Math.abs(change))}
                </p>
              )}
            </>
          );

          const cellClass = cn(
            "border-border min-h-20 border-r border-b px-2 py-1.5",
            !inPeriod && "bg-muted/20",
            isToday && "ring-primary/30 relative ring-1 ring-inset",
          );

          return point?.total == null ? (
            <div key={date} className={cellClass}>
              {content}
            </div>
          ) : (
            <Link
              key={date}
              href={dayHref(date)}
              scroll={false}
              className={cn(cellClass, "hover:bg-muted/40 block transition-colors")}
              title={`Lihat laporan ${date}`}
            >
              {content}
            </Link>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        <span className="bg-primary mr-1.5 inline-block size-1.5 rounded-full align-middle" />
        Hari dengan konfirmasi kepala cabang. Angka abu = saldo hari sebelumnya yang masih berlaku.
        Sel di luar periode diredupkan. Klik satu hari untuk memuat laporan hari itu.
      </p>
    </div>
  );
}

function MonthNav({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md border transition-colors";

  if (!href) {
    return (
      <span className={cn(className, "opacity-40")} aria-hidden>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} scroll={false} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
