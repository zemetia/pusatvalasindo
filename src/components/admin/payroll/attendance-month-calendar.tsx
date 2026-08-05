"use client";

// Kehadiran satu karyawan untuk satu bulan, gaya heatmap kalender (ala grafik
// kontribusi GitHub) — satu kotak per tanggal, warna = status hari itu. Dipakai
// di halaman detail gaji supaya HR bisa memeriksa dasar potongan absen sekali
// lihat, tanpa harus membaca daftar tanggal satu per satu.

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { Attendance, AttendanceStatus } from "@src/generated/prisma";

const STATUS_STYLE: Record<AttendanceStatus, { label: string; className: string }> = {
  PRESENT: { label: "Hadir", className: "bg-success text-success-foreground" },
  WFH: { label: "WFH", className: "bg-success/60 text-success-foreground" },
  LATE: { label: "Telat", className: "bg-warning text-warning-foreground" },
  PERMISSION: { label: "Izin", className: "bg-info text-info-foreground" },
  SICK: { label: "Sakit", className: "bg-info/60 text-info-foreground" },
  LEAVE: { label: "Cuti", className: "bg-info/35 text-info-foreground" },
  ABSENT: { label: "Alpha", className: "bg-destructive text-destructive-foreground" },
  HOLIDAY: { label: "Libur", className: "bg-muted text-muted-foreground" },
};

const EMPTY_CELL = "bg-muted/40 text-muted-foreground";
const FUTURE_CELL = "border-border text-muted-foreground border border-dashed";

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function AttendanceMonthCalendar({
  userId,
  month,
  year,
}: {
  userId: string;
  month: number;
  year: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-calendar", userId, month, year],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?userId=${userId}&month=${month}&year=${year}`);
      if (res.status === 403) return { forbidden: true as const, records: [] as Attendance[] };
      if (!res.ok) throw new Error("Gagal memuat kehadiran");
      const records = (await res.json()) as Attendance[];
      return { forbidden: false as const, records };
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.forbidden) {
    return (
      <p className="text-muted-foreground text-xs">
        Tidak punya akses melihat kehadiran karyawan ini.
      </p>
    );
  }

  // Kunci per tanggal (bukan objek Date) — kolom `date` disimpan @db.Date
  // (tengah malam UTC), jadi membaca tanggalnya lewat komponen UTC supaya
  // tidak bergeser sehari oleh zona waktu browser.
  const byDay = new Map<number, Attendance>();
  for (const r of data.records) {
    byDay.set(new Date(r.date).getUTCDate(), r);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  // getDay(): 0=Minggu..6=Sabtu → digeser supaya Senin di kolom pertama.
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const cells: Array<{ day: number } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day });
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isFuture = (day: number) => new Date(year, month - 1, day) > today;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="text-muted-foreground text-center text-[10px] font-medium tracking-wide uppercase"
          >
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const record = byDay.get(c.day);
          const style = record ? STATUS_STYLE[record.status] : null;
          const title = style
            ? `${c.day} ${monthLabel(month)} — ${style.label}`
            : isFuture(c.day)
              ? `${c.day} ${monthLabel(month)} — belum terjadi`
              : `${c.day} ${monthLabel(month)} — tidak ada catatan`;

          return (
            <div
              key={i}
              title={title}
              className={`tabular flex aspect-square items-center justify-center rounded-md text-[11px] font-medium ${
                style ? style.className : isFuture(c.day) ? FUTURE_CELL : EMPTY_CELL
              }`}
            >
              {c.day}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {(Object.keys(STATUS_STYLE) as AttendanceStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${STATUS_STYLE[s].className}`} />
            <span className="text-muted-foreground text-[11px]">{STATUS_STYLE[s].label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-sm ${EMPTY_CELL}`} />
          <span className="text-muted-foreground text-[11px]">Tidak ada catatan</span>
        </div>
      </div>
    </div>
  );
}

function monthLabel(month: number) {
  const names = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  return names[month] ?? "";
}
