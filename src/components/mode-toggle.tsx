"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Tombol tema. ThemeProvider dijalankan dengan `enableSystem={false}`, jadi hanya
 * ada dua kondisi nyata (light/dark) — cukup di-toggle langsung tanpa dropdown.
 */
export function ModeToggle({
  variant = "ghost",
  className,
}: {
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant={variant}
      size="icon"
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
    >
      <Sun className="size-[1.15rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-[1.15rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Ganti tema</span>
    </Button>
  );
}
