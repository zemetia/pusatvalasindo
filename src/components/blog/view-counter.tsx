"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { formatInt } from "@/lib/blog/format";
import { cn } from "@/lib/utils";

interface ViewCounterProps {
  postId: string;
  initialCount?: number;
  className?: string;
  showIcon?: boolean;
  label?: string; // default "pembaca"
}

/**
 * Menampilkan jumlah pembaca artikel dan secara otomatis mengirim sinyal
 * "artikel ini dibaca" ke /api/blog-view bila belum tercatat dalam sesi ini.
 */
export function ViewCounter({
  postId,
  initialCount = 0,
  className,
  showIcon = true,
  label = "pembaca",
}: ViewCounterProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    // Sinkronkan state jika initialCount dari SSR berubah
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    const key = `blog-view:${postId}`;
    let shouldRecord = true;
    try {
      if (window.sessionStorage.getItem(key)) {
        shouldRecord = false;
      } else {
        window.sessionStorage.setItem(key, "1");
      }
    } catch {
      // sessionStorage bisa melempar di browser tertentu/mode privat
    }

    if (!shouldRecord) return;

    void fetch("/api/blog-view", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, referrer: document.referrer || null }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.success && payload?.data?.counted) {
          if (typeof payload.data.viewCount === "number") {
            setCount(payload.data.viewCount);
          } else {
            setCount((prev) => prev + 1);
          }
        }
      })
      .catch(() => undefined);
  }, [postId]);

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 font-medium text-lp-ink-soft", className)}
      title={`${formatInt(count)} kali dibaca`}
    >
      {showIcon && <Eye className="size-4 text-lp-ink-mute shrink-0" aria-hidden="true" />}
      <span>
        {formatInt(count)} {label}
      </span>
    </span>
  );
}
