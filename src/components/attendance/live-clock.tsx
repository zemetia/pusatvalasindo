"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

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
        {format(time, "HH:mm:ss")}
      </span>
      <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
        {format(time, "EEEE, dd MMMM yyyy", { locale: id })}
      </span>
    </div>
  );
}
