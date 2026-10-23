"use client";

import dynamic from "next/dynamic";

import type { DailyViewsPoint } from "./blog-views-chart";

/** Recharts cukup besar; dimuat hanya di klien setelah halaman tampil supaya daftar artikel cepat terbuka. */
const Chart = dynamic(() => import("./blog-views-chart").then((m) => m.BlogViewsChart), {
  ssr: false,
  loading: () => <div aria-hidden className="bg-muted/40 h-64 w-full animate-pulse rounded-lg" />,
});

export function BlogViewsChartLazy({ data }: { data: DailyViewsPoint[] }) {
  return <Chart data={data} />;
}
