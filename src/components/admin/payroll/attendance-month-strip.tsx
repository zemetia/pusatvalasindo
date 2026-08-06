"use client";

// Kehadiran satu karyawan untuk satu bulan sebagai SATU BARIS bar tipis —
// gaya barcode, bukan kalender.
//
// Kalender 7 kolom memakan tinggi setengah layar hanya untuk memberi tahu satu
// hal: hari mana yang bermasalah. Di halaman slip gaji, kehadiran adalah bukti
// pendukung angka denda, bukan tempat orang mencari "Rabu tanggal berapa".
// Bentuk barcode menampilkan seluruh bulan dalam satu pandangan setinggi ±60px,
// dan tanggal beserta jam masuknya muncul saat kursor menyentuh barnya.
//
// Hari kosong BUKAN "tidak ada data": baris presensi hanya lahir kalau seseorang
// absen atau HR mengisinya, jadi hari yang sudah lewat tanpa baris apa pun
// berarti tidak masuk tanpa keterangan — alpha. Dulu hari begitu tampil abu-abu
// dan tidak ikut terhitung, sehingga bulan yang penuh bolong terbaca seolah
// bersih. Dikecualikan: Minggu dan tanggal merah (bukan hari kerja), hari ini
// (belum selesai), hari yang belum tiba, dan hari sebelum karyawan bergabung.
//
// Aturannya TIDAK ditulis di sini — dipinjam dari src/lib/workday.ts, yang juga
// dipakai perhitungan gaji. Jumlah alpha yang terlihat di sini dan jumlah hari
// yang dipotong dari gaji harus mustahil berbeda.

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  WORK_START_LABEL,
  formatJakartaTime,
  isLateArrival,
  jakartaDateIso,
  lateMinutesOfRecord,
} from "@/lib/attendance-time";
import { daysInMonth, deriveAlphaDays, isoOf } from "@/lib/workday";
import type { Attendance, AttendanceStatus } from "@src/generated/prisma";

// Hijau dan oranye tetap pekat — itu yang dibaca paling sering. Hanya merah yang
// diredam: alpha bisa menutup separuh bulan, dan sederet bar merah penuh membuat
// baris tipis ini berteriak lebih keras daripada angka gaji di sebelahnya.
const STATUS_STYLE: Record<AttendanceStatus, { label: string; bar: string; dot: string }> = {
  PRESENT: { label: "Hadir", bar: "bg-success", dot: "bg-success" },
  WFH: { label: "WFH", bar: "bg-success/55", dot: "bg-success/55" },
  LATE: { label: "Terlambat", bar: "bg-warning", dot: "bg-warning" },
  PERMISSION: { label: "Izin", bar: "bg-info", dot: "bg-info" },
  SICK: { label: "Sakit", bar: "bg-info/60", dot: "bg-info/60" },
  LEAVE: { label: "Cuti", bar: "bg-info/35", dot: "bg-info/35" },
  ABSENT: { label: "Alpha", bar: "bg-destructive/45", dot: "bg-destructive/45" },
  HOLIDAY: { label: "Libur", bar: "bg-muted-foreground/25", dot: "bg-muted-foreground/25" },
};

/** Alpha yang diturunkan dari hari kosong — sedikit lebih pucat daripada alpha
 *  yang memang dicatat HR, supaya keduanya masih bisa dibedakan. */
const DERIVED_ABSENT_BAR = "bg-destructive/25";

const EMPTY_BAR = "bg-muted";
const FUTURE_BAR = "bg-muted/40";

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
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

type DayCell = {
  day: number;
  iso: string;
  weekday: number;
  record: Attendance | null;
  future: boolean;
  /** Nama hari libur nasional, kalau tanggal ini tanggal merah. */
  holidayName: string | null;
  /** Sebelum karyawan ini bergabung — bukan alpha, memang belum bekerja. */
  sebelumGabung: boolean;
  /** Hari kerja yang sudah lewat tanpa satu pun catatan presensi. */
  alphaTurunan: boolean;
  /** Diturunkan dari checkIn, bukan dari `record.status`. */
  late: boolean;
  lateMinutes: number;
};

export function AttendanceMonthStrip({
  userId,
  month,
  year,
  joinDate,
}: {
  userId: string;
  month: number;
  year: number;
  /** Tanggal masuk kerja (ISO). Hari sebelumnya tidak dinilai alpha. */
  joinDate?: string | null;
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

  // Tanggal merah — dipisah dari query presensi karena isinya sama untuk semua
  // karyawan, jadi satu cache untuk seluruh halaman.
  const { data: holidays, isLoading: loadingHolidays } = useQuery({
    queryKey: ["public-holidays", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/public-holidays?month=${month}&year=${year}`);
      if (!res.ok) throw new Error("Gagal memuat hari libur");
      return (await res.json()) as { date: string; name: string; isJointLeave: boolean }[];
    },
  });

  // Menunggu keduanya: menilai alpha tanpa daftar tanggal merah akan membuat
  // hari libur nasional berkedip merah dulu sebelum diperbaiki sendiri.
  if (isLoading || loadingHolidays) return <Skeleton className="h-20 w-full" />;
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

  const totalHari = daysInMonth(year, month);
  // Hari ini menurut WIB, bukan UTC — lihat jakartaDateIso().
  const todayIso = jakartaDateIso();
  // Kolom `joinDate` disimpan sebagai tanggal (tengah malam UTC), jadi dibaca
  // sepuluh karakter pertama ISO-nya, bukan lewat getDate() lokal.
  const joinIso = joinDate ? new Date(joinDate).toISOString().slice(0, 10) : null;

  const holidayByDate = new Map((holidays ?? []).map((h) => [h.date, h]));
  const holidaySet = new Set(holidayByDate.keys());

  // Hari mana yang alpha DITENTUKAN oleh helper yang sama dengan yang dipakai
  // perhitungan gaji (src/lib/workday.ts) — bukan disalin ulang di sini.
  // Kalender yang menghitung sendiri akan menampilkan jumlah alpha yang berbeda
  // dari jumlah hari yang dipotong dari gajinya.
  const alphaSet = new Set(
    deriveAlphaDays({
      year,
      month,
      recordedDates: new Set(data.records.map((r) => new Date(r.date).toISOString().slice(0, 10))),
      holidays: holidaySet,
      todayIso,
      joinIso,
    })
  );

  const cells: DayCell[] = [];
  for (let day = 1; day <= totalHari; day++) {
    const iso = isoOf(year, month, day);
    const record = byDay.get(day) ?? null;
    const sebelumGabung = joinIso !== null && iso < joinIso;
    cells.push({
      day,
      iso,
      weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
      record,
      future: iso > todayIso,
      sebelumGabung,
      holidayName: holidayByDate.get(iso)?.name ?? null,
      alphaTurunan: alphaSet.has(iso),
      // Telat DITURUNKAN dari checkIn, bukan dibaca dari kolom status — lihat
      // isLateArrival(). `checkIn` menyeberang sebagai string ISO (JSON), bukan
      // Date; tipe Prisma di sini berbohong soal itu, jadi selalu di-parse ulang.
      late: record ? isLateArrival({ status: record.status, checkIn: toDate(record.checkIn) }) : false,
      lateMinutes: record
        ? lateMinutesOfRecord({ status: record.status, checkIn: toDate(record.checkIn) })
        : 0,
    });
  }

  const hariTelat = cells.filter((c) => c.late);
  const totalMenitTelat = hariTelat.reduce((s, c) => s + c.lateMinutes, 0);
  const tanpaJamMasuk = hariTelat.filter((c) => !c.record?.checkIn).length;

  // Semua hitungan memakai status EFEKTIF — termasuk alpha yang diturunkan dari
  // hari kosong — supaya ringkasan angka dan warna bar tidak bisa berbeda.
  const efektif = cells.map(effectiveStatusOf);

  const hadir = efektif.filter((s) => s === "PRESENT" || s === "WFH").length;
  const alpha = efektif.filter((s) => s === "ABSENT").length;
  const alphaTanpaCatatan = cells.filter((c) => c.alphaTurunan).length;
  const izin = efektif.filter(
    (s) => s === "PERMISSION" || s === "SICK" || s === "LEAVE"
  ).length;

  // Legenda hanya untuk status yang berasal dari baris presensi — alpha turunan
  // punya barisnya sendiri di bawah, dan menampilkan keduanya sebagai "Alpha"
  // membuat legenda seolah punya dua entri untuk hal yang sama.
  const statusHadir = new Set(
    cells.filter((c) => c.record).map(effectiveStatusOf).filter(Boolean) as AttendanceStatus[]
  );

  return (
    <div className="space-y-4">
      {/* ── Barcode ─────────────────────────────────────────────────────── */}
      <TooltipProvider delayDuration={80}>
        <div>
          <div className="flex items-stretch gap-[2px] sm:gap-[3px]">
            {cells.map((c) => (
              <Tooltip key={c.day}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={ariaLabelOf(c, month)}
                    className={`focus-visible:ring-ring/50 h-12 min-w-0 flex-1 rounded-[2px] outline-none transition-transform hover:scale-y-110 focus-visible:ring-[3px] sm:h-14 ${barClassOf(c)}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="px-2.5 py-1.5">
                  <TooltipBody cell={c} month={month} />
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Sumbu tanggal — hanya penanda tiap 5 hari + hari terakhir, supaya
              barisnya tetap terbaca meski barnya selebar 6px. */}
          <div className="mt-1.5 flex items-stretch gap-[2px] sm:gap-[3px]">
            {cells.map((c) => {
              const tandai = c.day === 1 || c.day % 5 === 0 || c.day === totalHari;
              return (
                <span
                  key={c.day}
                  className="text-muted-foreground tabular min-w-0 flex-1 text-center text-[9px] leading-none sm:text-[10px]"
                >
                  {tandai ? c.day : ""}
                </span>
              );
            })}
          </div>
        </div>
      </TooltipProvider>

      {/* ── Ringkasan angka ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t pt-3">
        <SummaryItem label="Hadir" value={`${hadir} hari`} />
        <SummaryItem
          label="Terlambat"
          value={`${hariTelat.length} hari`}
          tone={hariTelat.length > 0 ? "warning" : undefined}
          extra={
            hariTelat.length > 0
              ? `${totalMenitTelat.toLocaleString("id-ID")} menit total`
              : undefined
          }
        />
        <SummaryItem
          label="Alpha"
          value={`${alpha} hari`}
          tone={alpha > 0 ? "destructive" : undefined}
          extra={
            alphaTanpaCatatan > 0 ? `${alphaTanpaCatatan} tanpa catatan absensi` : undefined
          }
        />
        <SummaryItem label="Izin / Sakit / Cuti" value={`${izin} hari`} />
      </div>

      {tanpaJamMasuk > 0 && (
        <p className="text-muted-foreground text-xs text-pretty">
          {tanpaJamMasuk} hari berstatus terlambat tidak punya jam masuk (diisi manual) — hari
          itu tetap dihitung sebagai satu pelanggaran, tapi 0 menit, jadi tidak menambah denda.
        </p>
      )}

      {/* ── Legenda: hanya status yang benar-benar muncul bulan ini ─────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {(Object.keys(STATUS_STYLE) as AttendanceStatus[])
          .filter((s) => statusHadir.has(s))
          .map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-[2px] ${STATUS_STYLE[s].dot}`} />
              <span className="text-muted-foreground text-[11px]">{STATUS_STYLE[s].label}</span>
            </span>
          ))}
        {!statusHadir.has("HOLIDAY") && (
          <span className="flex items-center gap-1.5">
            <span className={`size-2 rounded-[2px] ${STATUS_STYLE.HOLIDAY.dot}`} />
            <span className="text-muted-foreground text-[11px]">Minggu / tanggal merah</span>
          </span>
        )}
        {alphaTanpaCatatan > 0 && (
          <span className="flex items-center gap-1.5">
            <span className={`size-2 rounded-[2px] ${DERIVED_ABSENT_BAR}`} />
            <span className="text-muted-foreground text-[11px]">
              Alpha (tanpa catatan absensi)
            </span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className={`size-2 rounded-[2px] ${EMPTY_BAR}`} />
          <span className="text-muted-foreground text-[11px]">Belum dinilai</span>
        </span>
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  extra,
  tone,
}: {
  label: string;
  value: string;
  extra?: string;
  tone?: "warning" | "destructive";
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className={`tabular mt-1 text-lg font-medium ${
          tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
      {extra && <p className="text-muted-foreground tabular mt-0.5 text-[11px]">{extra}</p>}
    </div>
  );
}

/** Tanggal dari nilai yang bisa berupa Date maupun string ISO hasil JSON. */
function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Status yang BENAR-BENAR ditampilkan.
 *
 * Kolom `status` hanya potret ambang saat baris dicatat, jadi ia tidak boleh
 * langsung menentukan warna: hari yang sebenarnya telat akan tampil hijau, dan
 * hari yang tepat waktu tampil oranye. Kehadiran (PRESENT/LATE) ditentukan
 * ulang dari `checkIn`; status non-kehadiran (izin, sakit, alpa, WFH) dibiarkan
 * apa adanya karena tidak bisa — dan tidak boleh — diturunkan dari jam masuk.
 */
function effectiveStatusOf(cell: DayCell): AttendanceStatus | null {
  // Hari yang sudah lewat tanpa catatan apa pun adalah alpha — tidak ada
  // baris presensi, tidak ada izin, tidak ada surat sakit.
  if (!cell.record) return cell.alphaTurunan ? "ABSENT" : null;
  const s = cell.record.status;
  if (s !== "PRESENT" && s !== "LATE") return s;
  return cell.late ? "LATE" : "PRESENT";
}

function TooltipBody({ cell, month }: { cell: DayCell; month: number }) {
  const efektif = effectiveStatusOf(cell);
  const style = efektif ? STATUS_STYLE[efektif] : null;
  const masuk = toDate(cell.record?.checkIn ?? null);
  const pulang = toDate(cell.record?.checkOut ?? null);
  const jamMasuk = masuk ? formatJakartaTime(masuk) : null;
  const jamPulang = pulang ? formatJakartaTime(pulang) : null;

  return (
    <div className="space-y-0.5">
      <p className="font-medium">
        {DAY_NAMES[cell.weekday]}, {cell.day} {MONTH_SHORT[month]}
      </p>
      <p className="opacity-90">{keteranganOf(cell, style?.label ?? null)}</p>
      {jamMasuk && (
        <p className="tabular opacity-90">
          Masuk {jamMasuk}
          {jamPulang ? ` · pulang ${jamPulang}` : ""}
        </p>
      )}
      {cell.late && (
        <p className="tabular opacity-90">
          {cell.lateMinutes > 0
            ? `Telat ${cell.lateMinutes} menit dari ${WORK_START_LABEL}`
            : "Tanpa jam masuk — 0 menit"}
        </p>
      )}
    </div>
  );
}

/**
 * Keterangan satu hari dalam satu kalimat — dipakai tooltip DAN aria-label,
 * supaya pembaca layar tidak mendengar penjelasan yang berbeda dari yang
 * terlihat.
 *
 * Urutannya adalah urutan kepastian: alpha (sudah pasti hari kerja yang lewat
 * tanpa catatan), lalu status yang benar-benar tercatat, lalu alasan-alasan
 * kenapa hari ini TIDAK dinilai.
 */
function keteranganOf(cell: DayCell, labelStatus: string | null): string {
  if (cell.alphaTurunan) return "Alpha — tidak ada catatan absensi";
  if (labelStatus) return labelStatus;
  if (cell.holidayName) return `Libur nasional — ${cell.holidayName}`;
  if (cell.weekday === 0) return "Minggu — bukan hari kerja";
  if (cell.future) return "Belum terjadi";
  if (cell.sebelumGabung) return "Belum bergabung";
  return "Belum ada catatan hari ini";
}

function barClassOf(cell: DayCell) {
  if (cell.alphaTurunan) return DERIVED_ABSENT_BAR;
  const efektif = effectiveStatusOf(cell);
  if (efektif) return STATUS_STYLE[efektif].bar;
  // Hari yang memang bukan hari kerja tampil seperti libur, bukan seperti data
  // yang hilang — tidak ada yang perlu diisi di sana.
  if (cell.holidayName || cell.weekday === 0) return STATUS_STYLE.HOLIDAY.bar;
  return cell.future ? FUTURE_BAR : EMPTY_BAR;
}

function ariaLabelOf(cell: DayCell, month: number) {
  const efektif = effectiveStatusOf(cell);
  const status = keteranganOf(cell, efektif ? STATUS_STYLE[efektif].label : null);
  const telat = cell.late && cell.lateMinutes > 0 ? `, ${cell.lateMinutes} menit` : "";
  return `${cell.day} ${MONTH_SHORT[month]}: ${status}${telat}`;
}
