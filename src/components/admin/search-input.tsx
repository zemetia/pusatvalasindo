"use client";

import { IconSearch, IconX } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Kotak pencarian standar untuk toolbar tabel admin. Sebelumnya tiap halaman
 * menyusun ulang ikon + padding sendiri dengan hasil yang sedikit berbeda-beda.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Cari...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="text"
        inputMode="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pr-8 pl-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Bersihkan pencarian"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 transition-colors"
        >
          <IconX className="size-3.5" />
        </button>
      )}
    </div>
  );
}
