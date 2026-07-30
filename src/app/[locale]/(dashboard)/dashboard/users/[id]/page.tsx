import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconArrowLeft,
  IconCalendarStats,
  IconChartBar,
  IconCoin,
  IconUser,
} from "@tabler/icons-react";

import prisma from "@/lib/prisma";
import { canViewPayrollOf } from "@/backend/services/payroll.service";
import { requireResource } from "@/backend/helpers/authz";
import { payrollIncentiveService } from "@/backend/services/payroll-incentive.service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { toKey, todayKeyJakarta } from "@/lib/finance-period";
import { formatCount, formatIdr, formatPercent, pctChange } from "@/lib/format";
import {
  MONTH_NAMES,
  SCORING_TYPE_LABELS,
  getGrade,
  gradeLabel,
  type KpiBreakdown,
} from "@/lib/kpi-utils";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  ErrorPanel,
  MetricBlock,
  MetricRow,
  PageHeader,
  PageShell,
  SectionCard,
} from "@/components/admin/page-shell";
import {
  AttendanceYearGrid,
  type AttendanceDay,
  type AttendanceStatusKey,
} from "@/components/admin/employee/attendance-year-grid";
import { KpiYearTrend, type KpiTrendPoint } from "@/components/admin/employee/kpi-year-trend";

/**
 * Detail satu karyawan: identitas, KPI, gaji, dan kalender kehadiran setahun.
 *
 * Seluruhnya dirender di server — pemilih tahun berupa tautan `?tahun=` supaya
 * tidak ada bundel client hanya untuk mengganti satu angka, dan supaya isi
 * halaman ikut ter-cache per URL.
 *
 * Penyajian angkanya mengikuti docs/blueprint/DATA_PRESENTATION.md: satu angka
 * hero, baris sorotan tanpa kartu, delta inline, dan tabel/kalender sebagai
 * satu-satunya wadah berkotak.
 */

const TIME = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  // Jam absensi selalu dibaca sebagai waktu operasional cabang, bukan waktu
  // server — jadi zonanya dikunci, tidak ikut lingkungan deploy.
  timeZone: "Asia/Jakarta",
});

/** Tanggal `@db.Date` disimpan pada tengah malam UTC — dibaca apa adanya. */
const DATE_FULL = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Timestamp biasa (mis. `calculatedAt`) dibaca di zona operasional. */
const TIMESTAMP_DATE = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

/** Tahun paling awal yang bisa dipilih: tahun berjalan dikurangi angka ini. */
const EARLIEST_YEAR_OFFSET = 6;

type Params = {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ tahun?: string }>;
};

/* ── Potongan kecil khusus halaman ini ────────────────────────────────────── */

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="mt-1 truncate text-sm">{value}</div>
    </div>
  );
}

/** Baris nominal gaji: label kiri, angka kanan, pemisah garis rambut saja. */
function AmountRow({
  label,
  value,
  note,
  tone = "default",
  emphasis = false,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  tone?: "default" | "success" | "destructive" | "muted";
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-2.5",
        emphasis && "border-t pt-3 font-semibold"
      )}
    >
      <div className="min-w-0">
        <span className={cn("text-sm", !emphasis && "text-muted-foreground")}>{label}</span>
        {note && <p className="text-muted-foreground mt-0.5 text-xs">{note}</p>}
      </div>
      <span
        className={cn(
          "tabular shrink-0 text-sm",
          !emphasis && "font-medium",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function masaKerja(joinDate: Date | null, today: string): string {
  if (!joinDate) return "—";
  const join = toKey(joinDate);
  if (join > today) return "—";
  const [jy, jm, jd] = join.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let months = (ty - jy) * 12 + (tm - jm);
  if (td < jd) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} bulan`;
  return rest === 0 ? `${years} tahun` : `${years} tahun ${rest} bulan`;
}

/* ── Halaman ──────────────────────────────────────────────────────────────── */

export default async function EmployeeDetailPage({ params, searchParams }: Params) {
  const { id, locale } = await params;
  const { tahun } = await searchParams;

  // Gerbangnya resource `users.detail` — terpisah dari `users` karena melihat
  // daftar pengguna tidak sama dengan boleh membuka rapor lengkap seseorang.
  // Scope PT-nya ikut dipakai di bawah untuk membatasi karyawan PT mana yang
  // boleh dibuka. Role global tetap lolos lewat resolve() sebagai jaring pengaman.
  const authz = await requireResource("users.detail", "view", locale);
  const isSelf = authz.userId === id;

  // "Hari ini" mengikuti WIB, bukan jam server — lihat todayKeyJakarta().
  const today = todayKeyJakarta();
  const currentYear = Number(today.slice(0, 4));
  // Rentang harus sama dengan daftar tahun di pemilih (EARLIEST_YEAR_OFFSET),
  // supaya tidak ada URL sah yang tampil tanpa tab aktif.
  const earliestYear = currentYear - EARLIEST_YEAR_OFFSET;
  const requestedYear = Number(tahun);
  const year =
    Number.isInteger(requestedYear) &&
    requestedYear >= earliestYear &&
    requestedYear <= currentYear
      ? requestedYear
      : currentYear;

  // Bagian absensi & KPI di halaman ini belum punya resource sendiri, jadi
  // gerbangnya masih memakai array izin lama — sumber yang sama persis dengan
  // sebelumnya (`caller.permissions`), kini dibaca lewat subjek izin.
  const permissions = authz.subject.legacyPermissions;

  // Gerbang absensi & KPI tidak bergantung pada PT target, jadi bisa diputuskan
  // sebelum query — yang tidak boleh dilihat tidak ikut ditarik.
  const canSeeAttendance = isSelf || can(permissions, PERMISSIONS.ATTENDANCE_VIEW_ALL);
  const canSeeKpi =
    can(permissions, PERMISSIONS.KPI_VIEW_ALL) ||
    (isSelf && can(permissions, PERMISSIONS.KPI_VIEW_OWN));
  // Gerbang gaji baru bisa dipastikan setelah PT target diketahui; sebelum itu
  // cukup superset-nya, hanya untuk memutuskan apakah skor KPI perlu ditarik.
  const maySeeSalary =
    can(permissions, PERMISSIONS.PAYROLL_VIEW_ALL) ||
    can(permissions, PERMISSIONS.PAYROLL_VIEW_COMPANY) ||
    (isSelf && can(permissions, PERMISSIONS.PAYROLL_VIEW_OWN));

  let data;
  try {
    data = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          phone: true,
          joinDate: true,
          isActive: true,
          createdAt: true,
          baseSalary: true,
          mealAllowance: true,
          transportAllowance: true,
          positionAllowance: true,
          bpjsKesehatan: true,
          customRole: { select: { id: true, name: true } },
          branch: {
            select: {
              id: true,
              name: true,
              companyId: true,
              company: { select: { name: true, code: true } },
            },
          },
        },
      }),
      canSeeAttendance
        ? prisma.attendance.findMany({
            where: {
              userId: id,
              date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) },
            },
            select: { date: true, status: true, checkIn: true, checkOut: true },
            orderBy: { date: "asc" },
          })
        : Promise.resolve([]),
      // Skor juga dibutuhkan pemegang akses gaji (untuk insentif) meski ia tidak
      // berhak melihat rincian KPI — rinciannya sendiri tetap tidak dirender.
      // `breakdownJson` sengaja tidak ikut: isinya besar dan hanya satu bulan
      // yang ditampilkan, jadi ditarik terpisah di bawah.
      canSeeKpi || maySeeSalary
        ? prisma.kpiMonthlyResult.findMany({
            // Tahun sebelumnya ikut ditarik supaya delta Januari punya pembanding.
            where: { employeeId: id, year: { in: [year - 1, year] } },
            select: {
              month: true,
              year: true,
              totalScore: true,
              grade: true,
              calculatedAt: true,
            },
            orderBy: [{ year: "asc" }, { month: "asc" }],
          })
        : Promise.resolve([]),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="users/[id]/page" message={msg} />;
  }

  const [employee, attendance, kpiResults] = data;
  if (!employee) notFound();

  const companyId = employee.branch?.companyId ?? null;
  // Karyawan di luar scope PT si pemanggil tidak pernah terlihat — kecuali
  // dirinya sendiri.
  if (!isSelf && !authz.canView(companyId)) {
    notFound();
  }

  // Bagian gaji ditampilkan hanya kalau pemanggil berhak atas gaji PT karyawan
  // ini (`payroll.manage`) atau ini memang dirinya sendiri (`payroll.self`).
  const canSeeSalary = canViewPayrollOf(authz.subject, authz.userId, id, companyId);

  /* ── Absensi ───────────────────────────────────────────────────────────── */

  const attendanceDays: AttendanceDay[] = attendance.map((a) => ({
    date: toKey(a.date),
    status: a.status,
    checkIn: a.checkIn ? TIME.format(a.checkIn) : null,
    checkOut: a.checkOut ? TIME.format(a.checkOut) : null,
  }));

  const counts: Record<AttendanceStatusKey, number> = {
    PRESENT: 0,
    LATE: 0,
    WFH: 0,
    PERMISSION: 0,
    SICK: 0,
    LEAVE: 0,
    ABSENT: 0,
    HOLIDAY: 0,
  };
  for (const day of attendanceDays) counts[day.status] += 1;

  // Hari libur dan cuti resmi tidak ikut penyebut — kehadiran diukur terhadap
  // hari kerja yang benar-benar tercatat, bukan terhadap 365 hari kalender.
  const workdays = attendanceDays.length - counts.HOLIDAY - counts.LEAVE;
  // WFH tetap hari kerja yang dijalani, jadi ikut dihitung hadir.
  const presentDays = counts.PRESENT + counts.LATE + counts.WFH;
  const attendanceRate = workdays > 0 ? (presentDays / workdays) * 100 : null;

  /* ── KPI ───────────────────────────────────────────────────────────────── */

  const resultsThisYear = kpiResults.filter((r) => r.year === year);
  const latest = resultsThisYear.length > 0 ? resultsThisYear[resultsThisYear.length - 1] : null;
  const previous = latest
    ? kpiResults.find(
        (r) =>
          (latest.month === 1 && r.year === latest.year - 1 && r.month === 12) ||
          (r.year === latest.year && r.month === latest.month - 1)
      )
    : undefined;

  const latestScore = latest ? Number(latest.totalScore) : null;
  const previousScore = previous ? Number(previous.totalScore) : null;
  const latestGrade = latestScore !== null ? getGrade(latestScore) : null;

  const trendPoints: KpiTrendPoint[] = Array.from({ length: 12 }, (_, i) => {
    const found = resultsThisYear.find((r) => r.month === i + 1);
    return {
      month: i + 1,
      score: found ? Number(found.totalScore) : null,
      grade: found?.grade ?? null,
    };
  });

  const scoredMonths = trendPoints.filter((p) => p.score != null);
  const averageScore =
    scoredMonths.length > 0
      ? scoredMonths.reduce((sum, p) => sum + (p.score ?? 0), 0) / scoredMonths.length
      : null;
  const averageGrade = averageScore !== null ? getGrade(averageScore) : null;

  /* ── Gaji ──────────────────────────────────────────────────────────────── */

  const salary = {
    base: employee.baseSalary != null ? Number(employee.baseSalary) : null,
    meal: employee.mealAllowance != null ? Number(employee.mealAllowance) : null,
    transport: employee.transportAllowance != null ? Number(employee.transportAllowance) : null,
    position: employee.positionAllowance != null ? Number(employee.positionAllowance) : null,
    bpjs: employee.bpjsKesehatan != null ? Number(employee.bpjsKesehatan) : null,
  };
  const grossFixed =
    (salary.base ?? 0) +
    (salary.meal ?? 0) +
    (salary.transport ?? 0) +
    (salary.position ?? 0) +
    (salary.bpjs ?? 0);

  // Gelombang kedua: insentif dan rincian KPI sama-sama bergantung pada periode
  // terakhir, jadi dijalankan berbarengan agar hanya menambah satu putaran ke DB.
  //
  // Insentif dibaca dari hasil KPI yang sudah tersimpan (tanpa menghitung ulang),
  // jadi membuka halaman ini tidak pernah mengubah data periode mana pun.
  let incentive: Awaited<ReturnType<typeof payrollIncentiveService.resolveForEmployee>> | null;
  let breakdown: KpiBreakdown | null;
  try {
    const [resolvedIncentive, latestDetail] = await Promise.all([
      canSeeSalary && latest
        ? payrollIncentiveService.resolveForEmployee(id, latest.month, latest.year)
        : Promise.resolve(null),
      canSeeKpi && latest
        ? prisma.kpiMonthlyResult.findUnique({
            where: {
              employeeId_month_year: { employeeId: id, month: latest.month, year: latest.year },
            },
            select: { breakdownJson: true },
          })
        : Promise.resolve(null),
    ]);
    incentive = resolvedIncentive;
    breakdown = (latestDetail?.breakdownJson ?? null) as KpiBreakdown | null;
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="users/[id]/page (rincian)" message={msg} />;
  }

  /* ── Susunan metrik ────────────────────────────────────────────────────── */

  const joinYear = employee.joinDate ? Number(toKey(employee.joinDate).slice(0, 4)) : currentYear;
  // Tahun yang sedang dibuka selalu ikut terdaftar, meski karyawannya baru
  // bergabung tahun ini — kalau tidak, tab aktifnya menghilang dari pemilih.
  const firstYear = Math.max(earliestYear, Math.min(joinYear, year));
  const years: number[] = [];
  for (let y = currentYear; y >= firstYear; y -= 1) years.push(y);

  const heroIsKpi = canSeeKpi && latestScore !== null;
  const periodLabel = latest ? `${MONTH_NAMES[latest.month]} ${latest.year}` : `${year}`;

  const supporting: ReactNode[] = [];
  // Blok kehadiran hanya perlu di baris pendukung bila hero sudah dipakai KPI.
  if (canSeeAttendance && heroIsKpi) {
    supporting.push(
      <MetricBlock
        key="kehadiran"
        label={`Kehadiran ${year}`}
        value={attendanceRate === null ? "—" : formatPercent(attendanceRate)}
        meta={`${formatCount(presentDays)} dari ${formatCount(workdays)} hari kerja tercatat`}
      />
    );
  }
  if (canSeeAttendance) {
    supporting.push(
      <MetricBlock
        key="telat"
        label={`Terlambat ${year}`}
        value={formatCount(counts.LATE)}
        suffix="hari"
        tone={counts.LATE > 0 ? "warning" : "default"}
        meta={`Alpa ${formatCount(counts.ABSENT)} · Izin ${formatCount(counts.PERMISSION)} · Sakit ${formatCount(counts.SICK)}`}
      />
    );
    // Hero sudah memakai angka kehadiran — slotnya diisi jumlah hari tercatat
    // supaya baris sorotan tidak pernah tersisa satu blok sendirian.
    if (!heroIsKpi) {
      supporting.push(
        <MetricBlock
          key="tercatat"
          label={`Hari Tercatat ${year}`}
          value={formatCount(attendanceDays.length)}
          suffix="hari"
          meta={`Termasuk ${formatCount(counts.HOLIDAY)} hari libur`}
        />
      );
    }
  }
  if (canSeeSalary) {
    supporting.push(
      <MetricBlock
        key="gaji"
        label="Gaji Kotor / Bulan"
        prefix="Rp"
        value={grossFixed > 0 ? formatIdr(grossFixed) : "—"}
        meta={grossFixed > 0 ? "Gaji pokok + seluruh tunjangan" : "Komponen gaji belum disetel"}
      />,
      <MetricBlock
        key="insentif"
        label="Insentif KPI"
        prefix="Rp"
        value={
          incentive && incentive.netAmount !== 0
            ? `${incentive.netAmount > 0 ? "+" : "−"}${formatIdr(Math.abs(incentive.netAmount))}`
            : incentive
              ? "0"
              : "—"
        }
        tone={
          !incentive || incentive.netAmount === 0
            ? "muted"
            : incentive.netAmount > 0
              ? "success"
              : "destructive"
        }
        meta={incentive ? `${incentive.outcomeLabel} · ${periodLabel}` : "Belum ada hasil KPI"}
      />
    );
  }
  const supportingBlocks = supporting.slice(0, 4);
  const supportingColumns =
    supportingBlocks.length >= 4 ? 4 : supportingBlocks.length === 3 ? 3 : 2;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Karyawan"
        title={employee.name}
        icon={<IconUser className="size-5" />}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{employee.customRole?.name ?? "Tanpa jabatan"}</span>
            <span aria-hidden>·</span>
            <span>{employee.branch?.name ?? "Tanpa cabang"}</span>
            {employee.branch?.company?.code && (
              <Badge variant="outline">{employee.branch.company.code}</Badge>
            )}
            <Badge variant={employee.isActive ? "success" : "soft"}>
              {employee.isActive ? "Aktif" : "Nonaktif"}
            </Badge>
          </span>
        }
        action={
          <>
            <div className="bg-muted/60 inline-flex items-center gap-1 rounded-lg p-1">
              {years.map((y) => (
                <Link
                  key={y}
                  href={`/dashboard/users/${id}?tahun=${y}`}
                  className={cn(
                    "tabular rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    y === year
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {y}
                </Link>
              ))}
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/users">
                <IconArrowLeft className="size-4" />
                Pengguna
              </Link>
            </Button>
          </>
        }
      />

      {/* Identitas — teks, bukan metrik: dipisah jarak & satu garis rambut. */}
      <section className="grid grid-cols-2 gap-x-8 gap-y-5 border-b pb-6 sm:grid-cols-3 lg:grid-cols-4">
        <Field
          label="Email"
          value={
            <span className="flex items-center gap-1.5">
              <span className="truncate">{employee.email}</span>
              {!employee.emailVerified && <Badge variant="warning">belum verif</Badge>}
            </span>
          }
        />
        {/* `||` bukan `??`: nomor kosong tersimpan sebagai "" pada data lama. */}
        <Field label="Telepon" value={employee.phone || <span className="text-muted-foreground">—</span>} />
        <Field
          label="Perusahaan"
          value={employee.branch?.company?.name ?? <span className="text-muted-foreground">—</span>}
        />
        <Field label="Cabang" value={employee.branch?.name ?? <span className="text-muted-foreground">—</span>} />
        <Field
          label="Jabatan"
          value={employee.customRole?.name ?? <span className="text-muted-foreground">—</span>}
        />
        <Field
          label="Bergabung"
          value={
            employee.joinDate ? (
              DATE_FULL.format(employee.joinDate)
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
        />
        <Field label="Masa Kerja" value={masaKerja(employee.joinDate, today)} />
        <Field label="Akun Dibuat" value={TIMESTAMP_DATE.format(employee.createdAt)} />
      </section>

      {/* Angka utama halaman ini. */}
      <section className="border-border border-y py-8">
        {heroIsKpi && latestScore !== null && latestGrade ? (
          <MetricBlock
            size="hero"
            tone={latestGrade.tone}
            label={`Skor KPI ${periodLabel}`}
            value={formatPercent(latestScore * 100)}
            delta={pctChange(previousScore, latestScore)}
            period="vs bulan sebelumnya"
            meta={
              <>
                Grade {latestGrade.letter} · {latestGrade.label}
                {latest && <> · dihitung {TIMESTAMP_DATE.format(latest.calculatedAt)}</>}
              </>
            }
          />
        ) : canSeeAttendance ? (
          <MetricBlock
            size="hero"
            label={`Kehadiran ${year}`}
            value={attendanceRate === null ? "—" : formatPercent(attendanceRate)}
            meta={
              attendanceRate === null
                ? "Belum ada catatan absensi tahun ini"
                : `${formatCount(presentDays)} hadir dari ${formatCount(workdays)} hari kerja tercatat`
            }
          />
        ) : (
          <MetricBlock
            size="hero"
            label="Status Karyawan"
            value={employee.isActive ? "Aktif" : "Nonaktif"}
            meta="Data kinerja tidak tersedia untuk akun Anda"
          />
        )}
      </section>

      {supportingBlocks.length >= 2 && (
        <MetricRow className="-mt-px" columns={supportingColumns as 2 | 3 | 4}>
          {supportingBlocks}
        </MetricRow>
      )}

      {/* ── Kehadiran tahunan ─────────────────────────────────────────────── */}
      {canSeeAttendance && (
        <SectionCard
          title={`Kalender Kehadiran ${year}`}
          description="Satu kotak mewakili satu hari kerja. Arahkan kursor untuk melihat jam masuk & keluar."
          icon={<IconCalendarStats className="size-4" />}
        >
          {attendanceDays.length === 0 ? (
            <EmptyState
              icon={<IconCalendarStats className="size-5" />}
              title={`Belum ada catatan absensi ${year}`}
              description="Kalender akan terisi otomatis setelah karyawan melakukan absen masuk."
            />
          ) : (
            <AttendanceYearGrid year={year} days={attendanceDays} counts={counts} />
          )}
        </SectionCard>
      )}

      {/* ── KPI ───────────────────────────────────────────────────────────── */}
      {canSeeKpi && (
        <>
          <section className="border-border border-t pt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <MetricBlock
                label={`Rata-rata Skor KPI ${year}`}
                tone={averageGrade?.tone ?? "muted"}
                value={averageScore === null ? "—" : formatPercent(averageScore * 100)}
                meta={
                  averageScore === null
                    ? "Belum ada bulan yang dinilai"
                    : `${formatCount(scoredMonths.length)} bulan dinilai · rata-rata grade ${averageGrade?.letter}`
                }
              />
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/kpi">
                  <IconChartBar className="size-4" />
                  Halaman KPI
                </Link>
              </Button>
            </div>
            <div className="mt-8">
              <KpiYearTrend points={trendPoints} />
            </div>
          </section>

          <SectionCard
            title={`Rincian KPI — ${periodLabel}`}
            description="Pencapaian per Key Result pada periode terakhir yang dihitung."
            icon={<IconChartBar className="size-4" />}
            padded={false}
          >
            {!breakdown || (breakdown.items ?? []).length === 0 ? (
              <EmptyState
                title="Belum ada rincian KPI"
                description="Rincian muncul setelah skor periode ini dihitung dari entri yang disetujui."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>KPI</TableHead>
                    <TableHead>Cara Penilaian</TableHead>
                    <TableHead className="text-right">Bobot</TableHead>
                    <TableHead>Perhitungan</TableHead>
                    <TableHead className="text-right">Pencapaian</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.items.map((item) => (
                    <TableRow key={item.roleKpiId}>
                      <TableCell className="font-medium">
                        {item.kpiName}
                        {item.noData && (
                          <span className="text-muted-foreground ml-1 text-[11px] font-normal">
                            · belum ada data
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="soft">
                          {SCORING_TYPE_LABELS[item.scoringType] ?? item.scoringType}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatPercent(item.weight * 100)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {item.explanation}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tabular text-right font-medium",
                          item.noData
                            ? "text-muted-foreground"
                            : getGrade(item.achievement).className
                        )}
                      >
                        {formatPercent(item.achievement * 100)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {latestScore !== null && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="border-t font-semibold">
                        Skor akhir — grade {latest?.grade ?? "—"} (
                        {gradeLabel(latest?.grade ?? "")})
                      </TableCell>
                      <TableCell className="tabular border-t text-right font-semibold">
                        {formatPercent(latestScore * 100)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </>
      )}

      {/* ── Gaji ──────────────────────────────────────────────────────────── */}
      {canSeeSalary && (
        <SectionCard
          title="Komponen Gaji"
          description="Nilai tetap bulanan. Potongan keterlambatan & absen dihitung saat penggajian."
          icon={<IconCoin className="size-4" />}
          footer={
            <span>
              Perhitungan resmi (termasuk potongan absensi) ada di{" "}
              <Link
                href="/dashboard/payroll"
                className="text-foreground font-medium underline underline-offset-2"
              >
                Hitung Gaji
              </Link>
              .
            </span>
          }
        >
          <div className="grid gap-x-10 lg:grid-cols-2">
            <div className="divide-y">
              <AmountRow
                label="Gaji Pokok"
                value={salary.base === null ? "—" : `Rp ${formatIdr(salary.base)}`}
                tone={salary.base === null ? "muted" : "default"}
                note={salary.base === null ? "Belum disetel" : undefined}
              />
              <AmountRow
                label="Uang Makan"
                value={salary.meal === null ? "—" : `Rp ${formatIdr(salary.meal)}`}
                tone={salary.meal === null ? "muted" : "default"}
              />
              <AmountRow
                label="Uang Transport"
                value={salary.transport === null ? "—" : `Rp ${formatIdr(salary.transport)}`}
                tone={salary.transport === null ? "muted" : "default"}
              />
              <AmountRow
                label="Tunjangan Jabatan"
                value={salary.position === null ? "—" : `Rp ${formatIdr(salary.position)}`}
                tone={salary.position === null ? "muted" : "default"}
              />
              <AmountRow
                label="BPJS Kesehatan"
                value={salary.bpjs === null ? "—" : `Rp ${formatIdr(salary.bpjs)}`}
                tone={salary.bpjs === null ? "muted" : "default"}
              />
              <AmountRow
                label="Gaji Kotor"
                value={`Rp ${formatIdr(grossFixed)}`}
                emphasis
              />
            </div>

            <div className="divide-y">
              <AmountRow
                label={`Insentif KPI — ${periodLabel}`}
                note={incentive?.outcomeLabel}
                value={
                  incentive
                    ? incentive.tierAmount === 0
                      ? "Rp 0"
                      : `${incentive.tierAmount > 0 ? "+" : "−"}Rp ${formatIdr(Math.abs(incentive.tierAmount))}`
                    : "—"
                }
                tone={
                  !incentive || incentive.tierAmount === 0
                    ? "muted"
                    : incentive.tierAmount > 0
                      ? "success"
                      : "destructive"
                }
              />
              <AmountRow
                label="Bonus Top Performer"
                note={
                  incentive?.rank
                    ? `Peringkat ${incentive.rank} dari ${incentive.peerCount} rekan sejabatan`
                    : undefined
                }
                value={
                  incentive && incentive.topPerformerBonus > 0
                    ? `+Rp ${formatIdr(incentive.topPerformerBonus)}`
                    : "Rp 0"
                }
                tone={
                  incentive && incentive.topPerformerBonus > 0 ? "success" : "muted"
                }
              />
              <AmountRow
                label="Estimasi Diterima"
                note="Sebelum potongan keterlambatan & absen"
                value={`Rp ${formatIdr(grossFixed + (incentive?.netAmount ?? 0))}`}
                emphasis
              />
              {incentive && (
                <p className="text-muted-foreground pt-3 text-xs leading-relaxed">
                  {incentive.reason}
                  {incentive.mandatorySaturday && (
                    <> — karyawan wajib masuk setiap Sabtu pada periode ini.</>
                  )}
                </p>
              )}
            </div>
          </div>
        </SectionCard>
      )}
    </PageShell>
  );
}
