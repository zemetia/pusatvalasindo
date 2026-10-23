"use client";

import dynamic from "next/dynamic";

/** BlockNote + Mantine cukup besar; dimuat hanya di klien saat editor dibuka. */
export const RichEditorLazy = dynamic(() => import("./rich-editor").then((m) => m.RichEditor), {
  ssr: false,
  loading: () => <div aria-hidden className="bg-muted/40 h-[clamp(30rem,72vh,48rem)] w-full animate-pulse" />,
});
