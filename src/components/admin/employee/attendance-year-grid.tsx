import type { AttendanceStatus } from "@src/generated/prisma/client";
import { addDays, toKey, todayKeyJakarta } from "@/lib/finance-period";
import { cn } from "@/lib/utils";

/**
 * Kalender kehadiran satu tahun bergaya kontribusi GitHub: satu kolom = satu
 * minggu (Senin di baris atas), satu kotak = satu hari.
 *
 * Warna kotak bersifat KATEGORIS (status kehadiran), bukan intensitas — jadi
 * seluruhnya diambil dari token semantik yang sama dengan badge status di modul
 * absensi (docs/blueprint/DATA_PRESENTATION.md §8). Komponen ini server-safe:
 * tidak ada state, keterangan per hari memakai atribut `title` bawaan browser.
 */

/**
 * Sengaja diturunkan dari enum Prisma, bukan ditulis ulang: menambah status
 * baru di schema akan langsung menggagalkan kompilasi peta warna di bawah,
 * alih-alih diam-diam merender kotak tanpa warna.
 */
export type AttendanceStatusKey = AttendanceStatus;

export type AttendanceDay = {
  /** Kunci tanggal UTC `YYYY-MM-DD`, sama seperti penyimpanan `@db.Date`. */
  date: string;
  status: AttendanceStatusKey;
  /** `HH:mm`, null bila belum absen masuk/keluar. */
  checkIn: string | null;
  checkOut: string | null;
};

export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatusKey,
  { label: string; cell: string }
> = {
  PRESENT: { label: "Hadir", cell: "bg-success" },
  LATE: { label: "Terlambat", cell: "bg-warning" },
  WFH: { label: "WFH", cell: "bg-success/50" },
  PERMISSION: { label: "Izin", cell: "bg-info" },
  SICK: { label: "Sakit", cell: "bg-info/50" },
  LEAVE: { label: "Cuti", cell: "bg-primary/40" },
  ABSENT: { label: "Alpa", cell: "bg-destructive" },
  HOLIDAY: { label: "Libur", cell: "bg-muted-foreground/25" },
};

/** Hari yang tidak punya catatan sama sekali — bukan status, jadi tetap netral. */
const EMPTY_CELL = "bg-muted";
const FUTURE_CELL = "bg-muted/40";

const MONTH_SHORT = [
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

const DAY_LABELS = ["Sen", "", "Rab", "", "Jum", "", "Min"];

const CELL_DATE = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function describe(key: string, day: AttendanceDay | undefined, future: boolean) {
  const date = CELL_DATE.format(new Date(`${key}T00:00:00.000Z`));
  if (!day) return `${date} — ${future ? "belum berjalan" : "tidak ada catatan"}`;

  const meta = ATTENDANCE_STATUS_META[day.status];
  const clock =
    day.checkIn || day.checkOut
      ? ` · masuk ${day.checkIn ?? "--:--"}, keluar ${day.checkOut ?? "--:--"}`
      : "";
  return `${date} — ${meta.label}${clock}`;
}

export function AttendanceYearGrid({
  year,
  days,
  counts,
}: {
  year: number;
  days: AttendanceDay[];
  /** Jumlah hari per status — dirender menyatu dengan legenda, bukan sebagai metrik. */
  counts?: Record<AttendanceStatusKey, number>;
}) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  // Batas "belum berjalan" memakai tanggal WIB: shift di sini mulai sore dan
  // selesai lewat tengah malam, jadi hari kerja harus dinilai pakai jam lokal.
  const today = todayKeyJakarta();

  // Kolom pertama mundur ke Senin sebelum 1 Januari supaya tiap baris selalu
  // hari yang sama sepanjang tahun.
  const firstOfYear = toKey(new Date(Date.UTC(year, 0, 1)));
  const lastOfYear = toKey(new Date(Date.UTC(year, 11, 31)));
  const mondayOffset = (new Date(`${firstOfYear}T00:00:00.000Z`).getUTCDay() + 6) % 7;

  const weeks: string[][] = [];
  let cursor = addDays(firstOfYear, -mondayOffset);
  while (cursor <= lastOfYear) {
    const week: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  // Satu label per bulan, ditaruh di kolom minggu pertama bulan tersebut.
  let labelledMonth = "";
  const monthLabels = weeks.map((week) => {
    const firstInYear = week.find((key) => key.startsWith(`${year}-`));
    if (!firstInYear) return null;
    const month = firstInYear.slice(0, 7);
    if (month === labelledMonth) return null;
    if (Number(firstInYear.slice(8, 10)) > 7) return null;
    labelledMonth = month;
    return MONTH_SHORT[Number(firstInYear.slice(5, 7))];
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Kisi 365 kotak tidak terbaca pembaca layar — ringkasannya disediakan. */}
      {counts && (
        <p className="sr-only">
          Ringkasan kehadiran {year}:{" "}
          {(Object.keys(ATTENDANCE_STATUS_META) as AttendanceStatusKey[])
            .map((status) => `${ATTENDANCE_STATUS_META[status].label} ${counts[status]} hari`)
            .join(", ")}
          .
        </p>
      )}
      <div className="overflow-x-auto pb-1">
        <div className="w-max">
          {/* Label bulan — lebar kolomnya dikunci sama dengan kolom minggu. */}
          <div className="flex gap-[3px]">
            <div className="w-9 shrink-0" aria-hidden />
            {monthLabels.map((label, index) => (
              <div key={index} className="relative h-4 w-3 shrink-0">
                {label && (
                  <span className="text-muted-foreground absolute top-0 left-0 text-[10px] whitespace-nowrap">
                    {label}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {/* Nama hari — hanya Sen/Rab/Jum/Min agar tidak berdesakan. */}
            <div className="flex w-9 shrink-0 flex-col gap-[3px] pr-1">
              {DAY_LABELS.map((label, index) => (
                <span
                  key={index}
                  className="text-muted-foreground flex h-3 items-center justify-end text-[10px] leading-none"
                >
                  {label}
                </span>
              ))}
            </div>

            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {week.map((key) => {
                  const inYear = key.startsWith(`${year}-`);
                  if (!inYear) {
                    return <div key={key} className="size-3 shrink-0" aria-hidden />;
                  }
                  const day = byDate.get(key);
                  const future = key > today;
                  return (
                    <div
                      key={key}
                      title={describe(key, day, future)}
                      className={cn(
                        "size-3 shrink-0 rounded-[3px]",
                        day
                          ? ATTENDANCE_STATUS_META[day.status].cell
                          : future
                            ? FUTURE_CELL
                            : EMPTY_CELL
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {(Object.keys(ATTENDANCE_STATUS_META) as AttendanceStatusKey[]).map((status) => (
          <span key={status} className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span
              className={cn("size-3 rounded-[3px]", ATTENDANCE_STATUS_META[status].cell)}
              aria-hidden
            />
            {ATTENDANCE_STATUS_META[status].label}
            {counts && (
              <span className="tabular text-foreground font-medium">
                {counts[status].toLocaleString("id-ID")}
              </span>
            )}
          </span>
        ))}
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span className={cn("size-3 rounded-[3px]", EMPTY_CELL)} aria-hidden />
          Tidak ada catatan
        </span>
      </div>
    </div>
  );
}
