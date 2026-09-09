"use client";

import { useEffect, useState } from "react";

// Jam presensi harus selalu WIB — bukan zona waktu PERANGKAT — supaya jam
// yang dilihat karyawan saat menekan tombol presensi sama dengan jam yang
// dicatat server. Lihat catatan yang sama di `src/lib/attendance-time.ts`.
const CLOCK_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const CLOCK_DATE = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export function LiveClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) return <div className="h-20" />;

  return (
    <div className="flex flex-col items-center justify-center space-y-2 py-6 bg-premium/5 rounded-2xl border border-premium/10 shadow-inner">
      <span className="text-5xl font-bold tracking-tighter text-premium">
        {CLOCK_TIME.format(time)}
      </span>
      <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
        {CLOCK_DATE.format(time)}
      </span>
    </div>
  );
}
