"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption = { value: string; label: string; hint?: string };

/**
 * Segmented control untuk filter singkat (paling sering: pemilih PT).
 *
 * Menggantikan deretan kartu besar `border-2 rounded-xl px-6 py-3` yang dulu
 * ditulis ulang di beberapa halaman — filter bukan konten utama, jadi tidak
 * perlu memakan ruang sebesar itu.
 */
export function SegmentedFilter({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "bg-muted/60 inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg p-1",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
