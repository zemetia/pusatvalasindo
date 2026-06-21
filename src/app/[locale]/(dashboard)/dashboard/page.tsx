export const maxDuration = 30; // extend Vercel function timeout to 30s

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  IconUsers,
  IconBuilding,
  IconFingerprint,
  IconBuildingBank,
  IconTargetArrow,
  IconCoin,
  IconDatabase,
  IconListDetails,
  IconId,
  IconArrowUpRight,
  IconArrowDownRight,
  IconReport,
  IconUserCircle,
  IconAlertTriangle,
  IconUserOff,
  IconChartBar,
} from "@tabler/icons-react";

type Numeric = { toString(): string } | string | number | null | undefined;

function fmtRate(val: Numeric): string {
  if (val == null) return "-";
  return Number(val.toString()).toLocaleString("id-ID");
}

function fmtCurrency(val: Numeric, code = "IDR"): string {
  if (val == null) return "-";
  return `${code} ${Number(val.toString()).toLocaleString("id-ID")}`;
}

const statusLabel: Record<string, string> = {
  PRESENT: "Hadir",
  LATE: "Terlambat",
  ABSENT: "Tidak Hadir",
  PERMISSION: "Izin",
  SICK: "Sakit",
  HOLIDAY: "Libur",
};

const bonusLabel: Record<string, string> = {
  BONUS_CASH: "Bonus",
  TOP_PERFORMER: "Top Performer",
  SAFE_ZONE: "Safe Zone",
  PENALTY_SATURDAY: "Penalti Sabtu",
  PENALTY_DEDUCTION: "Penalti Potong",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${locale}/login`);

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  let dashboardData;
  try {
    dashboardData = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),

      prisma.branch.count({ where: { isActive: true } }),

      prisma.attendance.count({
        where: { date: todayDate, status: { in: ["PRESENT", "LATE"] } },
      }),

      prisma.bankAccount.findMany({
        where: { isActive: true },
        include: { branch: true, currency: true },
        orderBy: [{ branch: { name: "asc" } }, { bankName: "asc" }],
      }),

      prisma.currencyStock.findMany({
        include: { branch: true, currency: true },
        orderBy: [{ branch: { name: "asc" } }, { currency: { code: "asc" } }],
      }),

      prisma.bankMutation.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { bankAccount: { include: { branch: true, currency: true } } },
      }),

      prisma.kpiMonthlyResult.findMany({
        where: { month: currentMonth, year: currentYear },
        include: {
          employee: {
            select: { name: true, branch: { select: { name: true } } },
          },
        },
        orderBy: { totalScore: "desc" },
        take: 5,
      }),

      prisma.attendance.findMany({
        where: { date: todayDate },
        include: {
          user: { select: { name: true, branch: { select: { name: true } } } },
        },
        orderBy: { checkIn: "desc" },
        take: 8,
      }),

      prisma.kpiLog.count({
        where: {
          createdAt: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1),
          },
        },
      }),

      // #1 — karyawan aktif yang belum punya record attendance hari ini
      prisma.user.findMany({
        where: {
          isActive: true,
          attendances: { none: { date: todayDate } },
        },
        select: {
          id: true,
          name: true,
          branch: { select: { name: true } },
        },
        orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      }),

      // #2 — total nilai stok hari ini (semua cabang)
      prisma.dailyStockEntry.aggregate({
        where: { date: todayDate },
        _sum: { totalIdr: true },
      }),

      // #2 — nilai stok per cabang
      prisma.dailyStockEntry.findMany({
        where: { date: todayDate },
        include: { stockItem: { include: { branch: true } } },
      }),

      // #3 — presensi mencurigakan hari ini
      prisma.attendance.findMany({
        where: { date: todayDate, isLocationSuspect: true },
        include: {
          user: { select: { name: true, branch: { select: { name: true } } } },
        },
      }),

      // #5 — berapa karyawan sudah dihitung KPI bulan ini
      prisma.kpiMonthlyResult.count({
        where: { month: currentMonth, year: currentYear },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[dashboard/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }

  const [
    totalEmployees,
    totalBranches,
    todayAttendanceCount,
    bankAccounts,
    currencyStocks,
    recentMutations,
    kpiResults,
    todayAttendanceList,
    totalKpiLogsThisMonth,
    // #1 - belum absen hari ini
    notYetAbsent,
    // #2 - nilai stok harian
    todayStockAggregate,
    todayStockByBranch,
    // #3 - location suspect
    suspectAttendance,
    // #5 - status payroll
    kpiCalculatedCount,
  ] = dashboardData;

  // Aggregate stok per cabang dari data mentah
  const stockByBranch = todayStockByBranch.reduce<
    Record<string, { branchName: string; totalIdr: number }>
  >((acc, entry) => {
    const branchId = entry.stockItem.branchId;
    const branchName = entry.stockItem.branch.name;
    if (!acc[branchId]) acc[branchId] = { branchName, totalIdr: 0 };
    acc[branchId].totalIdr += Number(entry.totalIdr ?? 0);
    return acc;
  }, {});

  const totalStockIDR = Number(todayStockAggregate._sum.totalIdr ?? 0);
  const activeBankAccountsCount = bankAccounts.length;

  const quickLinks = [
    { href: "/dashboard/attendance", label: "Presensi", icon: IconFingerprint },
    { href: "/dashboard/kpi", label: "Konfigurasi KPI", icon: IconTargetArrow },
    { href: "/dashboard/kpi/definitions", label: "Definisi KPI", icon: IconListDetails },
    { href: "/dashboard/kpi/log", label: "Log KPI", icon: IconReport },
    { href: "/dashboard/payroll", label: "Hitung Gaji", icon: IconCoin },
    { href: "/dashboard/bank-accounts", label: "Rekening Bank", icon: IconBuildingBank },
    { href: "/dashboard/stock-management", label: "Stock Mata Uang", icon: IconDatabase },
    { href: "/dashboard/stok-harian", label: "Stok Harian", icon: IconListDetails },
    { href: "/dashboard/users", label: "Pengguna", icon: IconUsers },
    { href: "/dashboard/branches", label: "Cabang", icon: IconBuilding },
    { href: "/dashboard/roles", label: "Role & Akses", icon: IconId },
    { href: "/dashboard/account", label: "Akun Saya", icon: IconUserCircle },
  ];

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ringkasan operasional Pusat Valas Indo —{" "}
          {now.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* #3 — Alert: Presensi Mencurigakan */}
      {suspectAttendance.length > 0 && (
        <Card className="border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="size-5 text-orange-500" />
              <CardTitle className="text-base text-orange-700 dark:text-orange-400">
                Presensi Lokasi Mencurigakan — {suspectAttendance.length} karyawan
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suspectAttendance.map((att) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium text-sm">
                      {att.user.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {att.user.branch?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {att.checkIn
                        ? att.checkIn.toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-xs">
                        GPS Tidak Sesuai
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 @xl/main:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Karyawan Aktif
            </CardTitle>
            <IconUsers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total karyawan terdaftar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cabang Aktif
            </CardTitle>
            <IconBuilding className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalBranches}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cabang beroperasi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Presensi Hari Ini
            </CardTitle>
            <IconFingerprint className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayAttendanceCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Hadir dari {totalEmployees} karyawan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Log KPI Bulan Ini
            </CardTitle>
            <IconTargetArrow className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalKpiLogsThisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Entri KPI dicatat
            </p>
          </CardContent>
        </Card>
      </div>

      {/* #2 + #5 — Nilai Stok & Status Payroll */}
      <div className="grid gap-4 @xl/main:grid-cols-3">
        {/* #2 — Nilai Stok Hari Ini */}
        <Card className="@xl/main:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Nilai Stok Harian</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total nilai stok hari ini berdasarkan rate IDR
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/stok-harian">Isi Stok →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(stockByBranch).length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Belum ada entri stok hari ini.{" "}
                <Link href="/dashboard/stok-harian" className="underline">
                  Isi sekarang
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-end justify-between mb-4">
                  <span className="text-sm text-muted-foreground">
                    Total semua cabang
                  </span>
                  <span className="text-2xl font-bold font-mono">
                    {fmtCurrency(totalStockIDR)}
                  </span>
                </div>
                <div className="divide-y">
                  {Object.values(stockByBranch).map((branch) => (
                    <div
                      key={branch.branchName}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sm">{branch.branchName}</span>
                      <span className="font-mono text-sm font-medium">
                        {fmtCurrency(branch.totalIdr)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* #5 — Status Payroll */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Status Payroll</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {now.toLocaleDateString("id-ID", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <IconChartBar className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold">
                  {kpiCalculatedCount}
                  <span className="text-xl font-normal text-muted-foreground">
                    /{totalEmployees}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  karyawan sudah dihitung
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all"
                  style={{
                    width:
                      totalEmployees > 0
                        ? `${Math.min(100, (kpiCalculatedCount / totalEmployees) * 100)}%`
                        : "0%",
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-md bg-muted p-2">
                  <div className="font-semibold text-sm">{kpiCalculatedCount}</div>
                  <div className="text-muted-foreground">Selesai</div>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="font-semibold text-sm">
                    {totalEmployees - kpiCalculatedCount}
                  </div>
                  <div className="text-muted-foreground">Belum</div>
                </div>
              </div>

              {kpiCalculatedCount < totalEmployees && (
                <Button size="sm" asChild className="w-full">
                  <Link href="/dashboard/payroll">Hitung Sekarang</Link>
                </Button>
              )}
              {kpiCalculatedCount >= totalEmployees && totalEmployees > 0 && (
                <Badge className="justify-center py-1">
                  ✓ Semua karyawan selesai
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Currency Rates + Quick Links */}
      <div className="grid gap-6 @xl/main:grid-cols-3">
        {/* Currency Rates */}
        <div className="@xl/main:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Kurs Mata Uang</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/stock-management">Lihat Semua →</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {currencyStocks.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm px-6">
                  Belum ada data kurs mata uang. Tambahkan melalui menu{" "}
                  <Link
                    href="/dashboard/stock-management"
                    className="underline"
                  >
                    Stock Mata Uang
                  </Link>
                  .
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cabang</TableHead>
                      <TableHead>Mata Uang</TableHead>
                      <TableHead className="text-right">Kurs Beli</TableHead>
                      <TableHead className="text-right">Kurs Jual</TableHead>
                      <TableHead className="text-right">Stok</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencyStocks.map((cs) => (
                      <TableRow key={cs.id}>
                        <TableCell className="text-sm">
                          {cs.branch.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{cs.currency.code}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtRate(cs.buyRate)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtRate(cs.sellRate)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Number(cs.quantity).toLocaleString("id-ID")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Navigation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Navigasi Cepat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pb-4">
            {quickLinks.map(({ href, label, icon: Icon }) => (
              <Button
                key={href}
                variant="outline"
                size="sm"
                asChild
                className="justify-start gap-2"
              >
                <Link href={href}>
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* #1 — Karyawan Belum Absen + Kehadiran Hari Ini */}
      <div className="grid gap-6 @xl/main:grid-cols-2">
        {/* #1 — Belum Absen */}
        <Card className={notYetAbsent.length > 0 ? "border-yellow-300 dark:border-yellow-800" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconUserOff className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Belum Absen Hari Ini</CardTitle>
              </div>
              {notYetAbsent.length > 0 && (
                <Badge variant="outline" className="border-yellow-400 text-yellow-700 dark:text-yellow-400">
                  {notYetAbsent.length} karyawan
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {notYetAbsent.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm px-6">
                <span className="text-green-600 font-medium">✓ Semua karyawan sudah absen</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Cabang</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notYetAbsent.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-sm">
                        {u.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.branch?.name ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Kehadiran Hari Ini */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Kehadiran Hari Ini</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/attendance">Lihat →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {todayAttendanceList.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm px-6">
                Belum ada presensi hari ini
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAttendanceList.map((att) => (
                    <TableRow key={att.id}>
                      <TableCell className="font-medium text-sm">
                        {att.user.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {att.user.branch?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {att.checkIn
                          ? att.checkIn.toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            att.status === "PRESENT"
                              ? "default"
                              : att.status === "LATE"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {statusLabel[att.status] ?? att.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bank Mutations + Bank Accounts */}
      <div className="grid gap-6 @xl/main:grid-cols-2">
        {/* Recent Bank Mutations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Mutasi Bank Terbaru</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/bank-accounts">Lihat →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentMutations.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm px-6">
                Belum ada mutasi bank
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank / Cabang</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMutations.map((mut) => (
                    <TableRow key={mut.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {mut.bankAccount.bankName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {mut.bankAccount.branch.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {mut.type === "CREDIT" ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <IconArrowUpRight className="size-3.5" />
                            Masuk
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                            <IconArrowDownRight className="size-3.5" />
                            Keluar
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {fmtCurrency(
                          mut.amount,
                          mut.bankAccount.currency.code
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {mut.createdAt.toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Bank Accounts Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Rekening Bank Aktif</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeBankAccountsCount} rekening di semua cabang
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/bank-accounts">Kelola →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {bankAccounts.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm px-6">
                Belum ada rekening bank aktif
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cabang</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Mata Uang</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="text-sm">
                        {acc.branch.name}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {acc.bankName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{acc.currency.code}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {fmtCurrency(acc.balance, acc.currency.code)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPI Monthly Results */}
      {kpiResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Hasil KPI Bulan Ini</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Top performers —{" "}
                  {now.toLocaleDateString("id-ID", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/kpi/log">Lihat Log →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead className="text-right">Total Skor</TableHead>
                  <TableHead>Hasil Bonus</TableHead>
                  <TableHead className="text-right">Nominal Bonus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiResults.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {r.employee.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.employee.branch?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {Number(r.totalScore).toFixed(1)}
                    </TableCell>
                    <TableCell>
                      {r.bonusResult && (
                        <Badge
                          variant={
                            r.bonusResult === "BONUS_CASH" ||
                            r.bonusResult === "TOP_PERFORMER"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {bonusLabel[r.bonusResult] ?? r.bonusResult}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.bonusAmount != null
                        ? fmtCurrency(r.bonusAmount)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
