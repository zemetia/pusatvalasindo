"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export type DailyViewsPoint = { day: string; views: number; visitors: number };

const config = {
  views: { label: "Tampilan", color: "var(--primary)" },
  visitors: { label: "Pengunjung", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-10-20" → "20 Okt". Diurai manual (bukan new Date) supaya tidak bergeser oleh zona waktu browser. */
function shortDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1] ?? ""}`;
}

function longDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1] ?? ""} ${y}`;
}

/**
 * Tampilan per hari. Fokusnya satu seri (tampilan, warna primer); pengunjung
 * hanya pembanding yang diredam. Tanpa kotak/latar pada grafik, hanya garis kisi
 * horizontal — sesuai docs/blueprint/DATA_PRESENTATION.md §9.
 */
export function BlogViewsChart({ data }: { data: DailyViewsPoint[] }) {
  const hasData = data.some((p) => p.views > 0);

  return (
    <div className="relative">
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }} accessibilityLayer>
          <defs>
            <linearGradient id="blog-views-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-views)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--color-views)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={shortDay}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(v: number) => new Intl.NumberFormat("id-ID").format(v)}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" labelFormatter={(_, payload) => longDay(String(payload?.[0]?.payload?.day ?? ""))} />}
          />
          <Area
            dataKey="visitors"
            type="monotone"
            stroke="var(--color-visitors)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            fill="none"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="views"
            type="monotone"
            stroke="var(--color-views)"
            strokeWidth={2}
            fill="url(#blog-views-fill)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
      {!hasData && (
        <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center pb-6 text-sm">
          Belum ada tampilan pada periode ini
        </p>
      )}
    </div>
  );
}
