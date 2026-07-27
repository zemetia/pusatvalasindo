"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

interface TradingViewMiniChartProps {
  symbol: string;
}

// Official TradingView "mini symbol overview" embed widget — no scraping,
// just injecting their documented script tag. Some exotic currency pairs
// (e.g. IQD, KHR) have no TradingView listing; the widget then simply shows
// "no data available", which is an acceptable degraded state here.
export function TradingViewMiniChart({ symbol }: TradingViewMiniChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    el.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      width: "100%",
      height: 220,
      locale: "id",
      dateRange: "1M",
      colorTheme: resolvedTheme === "dark" ? "dark" : "light",
      isTransparent: true,
      autosize: true,
    });
    el.appendChild(script);
  }, [symbol, resolvedTheme]);

  return (
    <div className="tradingview-widget-container rounded-md border p-2" ref={container} key={symbol}>
      <div className="tradingview-widget-container__widget" />
    </div>
  );
}
