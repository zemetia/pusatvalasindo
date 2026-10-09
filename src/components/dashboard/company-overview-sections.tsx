// Blok "bisnis" yang dipakai bersama oleh dashboard-owner.tsx dan
// dashboard-kepala-cabang.tsx (dan opsional oleh dashboard-pegawai.tsx untuk role
// dengan izin lintas-tim seperti HR/Akuntan). Ini komposisi komponen biasa, bukan
// flag isRoleX — tiap dashboard memilih sendiri flag & scope datanya lalu merender
// blok ini apa adanya.
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconAlertTriangle,
  IconUserOff,
  IconClockCheck,
  IconArrowRight,
} from "@tabler/icons-react";
import {
  SectionCard,
  EmptyState,
  MetricRow,
  MetricBlock,
  DeltaPill,
  MoneyDisplay,
} from "@/components/admin/page-shell";
import {
  fmtRate,
  fmtAmount,
  currencySymbol,
  latestBalanceByAccount,
  statusLabel,
  type CompanyOverviewFlags,
  type CurrencyCard,
  type BankCurrencyGroup,
  type getCompanyOverview,
} from "@/backend/services/dashboard-data.service";
import { formatJakartaTime } from "@/lib/attendance-time";
import { cn } from "@/lib/utils";

type Overview = Awaited<ReturnType<typeof getCompanyOverview>>;

export function CompanyOverviewSections({
  flags,
  overview,
  currencyCards,
  bankGroups,
  primaryBankGroup,
  bankTrendPct,
  canApproveCorrections,
  canManagePayroll,
  global,
  now,
}: {
  flags: CompanyOverviewFlags;
  overview: Overview;
  currencyCards: CurrencyCard[];
  bankGroups: BankCurrencyGroup[];
  primaryBankGroup: BankCurrencyGroup | null;
  bankTrendPct: number | null;
  canApproveCorrections: boolean;
  canManagePayroll: boolean;
  global: boolean;
  now: Date;
}) {
  // Saldo yang ditampilkan = isian Saldo Bank Harian terakhir, sumber yang sama
  // dengan metrik "Saldo Bank" di atas. `BankAccount.balance` (buku mutasi) tidak dipakai.
  const dailyBalanceByAccount = latestBalanceByAccount(overview.dailyBankBalances);

  const showBentoOverview =
    flags.usersCount ||
    flags.branchesCount ||
    flags.attendanceAll ||
    flags.kpiAll ||
    flags.bank ||
    flags.payrollTeam;

  return (
    <>
      {/* Alert: Presensi Mencurigakan */}
      {flags.suspicious && overview.suspectAttendance.length > 0 && (
        <Card className="border-warning/30 bg-card gap-0 overflow-hidden py-0 shadow-xs">
          <CardHeader className="bg-warning-muted/40 border-b border-warning/20 py-3.5 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <IconAlertTriangle className="text-warning size-5 shrink-0" />
                <CardTitle className="text-warning-foreground text-sm font-semibold">
                  Presensi Lokasi Mencurigakan
                </CardTitle>
              </div>
              <Badge variant="warning">{overview.suspectAttendance.length} karyawan</Badge>
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
                {overview.suspectAttendance.map((att) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium text-sm text-foreground">
                      {att.user.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {att.user.branch?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm font-mono tabular">
                      {att.checkIn ? formatJakartaTime(att.checkIn) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="danger">GPS Tidak Sesuai</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Alert: Pengajuan Koreksi Pending */}
      {flags.corrections && overview.pendingCorrections.length > 0 && (
        <Card className="border-info/30 bg-card gap-0 overflow-hidden py-0 shadow-xs">
          <CardHeader className="bg-info-muted/40 border-b border-info/20 py-3.5 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <IconClockCheck className="text-info size-5 shrink-0" />
                <CardTitle className="text-sm font-semibold">
                  Pengajuan Koreksi Menunggu Verifikasi
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info">{overview.pendingCorrections.length} usulan</Badge>
                {canApproveCorrections && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/dashboard/persetujuan-koreksi">Tinjau →</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Perubahan Kurs (Saat Ini → Usulan)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.pendingCorrections.map((c) => {
                  const currentVal = c.currentValue != null ? Number(c.currentValue.toString()) : null;
                  const proposedVal = c.proposedValue != null ? Number(c.proposedValue.toString()) : null;
                  const diff =
                    currentVal != null && proposedVal != null && !Number.isNaN(currentVal) && !Number.isNaN(proposedVal)
                      ? proposedVal - currentVal
                      : null;

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-sm text-foreground">
                        {c.targetLabel}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.date.toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          timeZone: "Asia/Jakarta",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-2 font-mono text-sm tabular">
                          <span className="text-muted-foreground">{fmtRate(c.currentValue)}</span>
                          <IconArrowRight className="size-3 text-muted-foreground/60 shrink-0" />
                          <span className="font-semibold text-foreground">{fmtRate(c.proposedValue)}</span>
                          {diff != null && diff !== 0 && (
                            <span
                              className={cn(
                                "text-[11px] font-semibold px-2 py-0.5 rounded-full border tabular ml-1",
                                diff > 0
                                  ? "border-success/20 bg-success-muted text-success dark:bg-success/15 dark:text-success"
                                  : "border-destructive/20 bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive"
                              )}
                            >
                              {diff > 0 ? `+${diff.toLocaleString("id-ID")}` : diff.toLocaleString("id-ID")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Ringkasan Bisnis — metrik utama terstruktur bersih */}
      {showBentoOverview && (
        <MetricRow title="Ringkasan Bisnis" columns={4} className="-mt-px">
          {flags.bank && primaryBankGroup && (
            <MetricBlock
              label="Saldo Bank"
              prefix={currencySymbol(primaryBankGroup.code)}
              value={fmtAmount(primaryBankGroup.total)}
              delta={bankTrendPct}
              period="vs isian sebelumnya"
              meta={
                <>
                  <span className="font-medium text-foreground">
                    {primaryBankGroup.filledCount < primaryBankGroup.count
                      ? `${primaryBankGroup.filledCount}/${primaryBankGroup.count} rekening ${primaryBankGroup.code} terisi`
                      : `${primaryBankGroup.count} rekening ${primaryBankGroup.code}`}
                  </span>
                  {bankGroups.length > 1 && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {bankGroups
                        .filter((g) => g.currencyId !== primaryBankGroup.currencyId)
                        .map((g) => `${g.code} ${g.total.toLocaleString("id-ID")}`)
                        .join(" · ")}
                    </span>
                  )}
                </>
              }
            />
          )}

          {flags.attendanceAll && (
            <MetricBlock
              label="Presensi Hari Ini"
              value={overview.todayAttendanceCount.toLocaleString("id-ID")}
              suffix={`/ ${overview.totalUsers}`}
              meta={
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular",
                      overview.attendancePct != null && overview.attendancePct >= 80
                        ? "border-success/20 bg-success-muted text-success dark:bg-success/15 dark:text-success"
                        : "border-warning/25 bg-warning-muted text-warning-foreground"
                    )}
                  >
                    {overview.attendancePct != null ? `${overview.attendancePct.toFixed(0)}% kehadiran` : "—"}
                  </span>
                  <span className="text-muted-foreground text-xs">karyawan hadir</span>
                </div>
              }
            />
          )}

          {flags.kpiAll && (
            <MetricBlock
              label="KPI Bulan Ini"
              value={
                overview.kpiAvgThisMonth != null
                  ? overview.kpiAvgThisMonth.toFixed(1).replace(".", ",")
                  : overview.kpiLogsThisMonth
              }
              delta={overview.kpiTrendPct}
              period="vs bulan lalu"
              meta={
                overview.kpiAvgThisMonth != null
                  ? `Rata-rata skor tim · ${overview.kpiLogsThisMonth} entri tercatat`
                  : `${overview.kpiLogsThisMonth} entri KPI tercatat`
              }
            />
          )}

          {flags.payrollTeam && (
            <MetricBlock
              label="Payroll Bulan Ini"
              value={overview.payrollDoneCount.toLocaleString("id-ID")}
              suffix={`/ ${overview.payrollTotalEmployees}`}
              delta={overview.highPerformerTrendPct}
              period={`${overview.highPerformersThisMonth} skor ≥80% vs bln lalu`}
              meta="karyawan sudah dihitung"
              action={
                canManagePayroll && overview.payrollDoneCount < overview.payrollTotalEmployees ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/dashboard/payroll">Hitung Gaji →</Link>
                  </Button>
                ) : overview.payrollTotalEmployees > 0 ? (
                  <Badge variant="success">✓ Selesai</Badge>
                ) : undefined
              }
            />
          )}
        </MetricRow>
      )}

      {/* Organisasi */}
      {(flags.usersCount || flags.branchesCount) && (
        <MetricRow title="Organisasi" columns={2} className="-mt-px">
          {flags.usersCount && (
            <MetricBlock
              label="Karyawan Aktif"
              size="secondary"
              value={overview.totalUsers.toLocaleString("id-ID")}
              meta="Total karyawan terdaftar di sistem"
            />
          )}
          {flags.branchesCount && (
            <MetricBlock
              label="Cabang Aktif"
              size="secondary"
              value={overview.totalBranches.toLocaleString("id-ID")}
              meta="Cabang beroperasi saat ini"
            />
          )}
        </MetricRow>
      )}

      {/* Currency Rates Cards */}
      {flags.stock && (
        <SectionCard
          title="Kurs Mata Uang"
          description={`${currencyCards.length} mata uang aktif`}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/stockist">Lihat Semua →</Link>
            </Button>
          }
        >
          {currencyCards.length === 0 ? (
            <EmptyState
              title="Belum ada data kurs mata uang"
              description={
                <>
                  Tambahkan melalui menu{" "}
                  <Link href="/dashboard/stockist" className="underline">
                    Stock Mata Uang
                  </Link>
                  .
                </>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {currencyCards.map((c) => {
                const buyVal = c.avgBuy != null ? Number(c.avgBuy.toString()) : null;
                const sellVal = c.avgSell != null ? Number(c.avgSell.toString()) : null;
                const spread =
                  sellVal != null && buyVal != null && !Number.isNaN(sellVal) && !Number.isNaN(buyVal)
                    ? sellVal - buyVal
                    : null;

                return (
                  <div
                    key={c.currencyId}
                    className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-xs"
                  >
                    <div>
                      {/* Header Kartu: Kode, Nama, dan Trend Pill */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="inline-flex items-center justify-center rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-primary border border-primary/20 shrink-0">
                            {c.code}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {c.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {c.branchCount} cabang aktif
                            </p>
                          </div>
                        </div>
                        <DeltaPill value={c.trendPct} />
                      </div>

                      {/* Pilar Kurs: Beli & Jual */}
                      <div className="mt-3.5 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
                            <span>Beli</span>
                            <span className="text-[9px] text-muted-foreground/70 font-normal">KAMI BELI</span>
                          </div>
                          <div className="mt-1 font-semibold text-base sm:text-lg tabular tracking-tight text-foreground">
                            {buyVal != null ? (
                              <>
                                <span className="text-xs text-muted-foreground/75 font-normal mr-1 select-none">
                                  Rp
                                </span>
                                <span>{buyVal.toLocaleString("id-ID")}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground font-normal text-sm">—</span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
                            <span>Jual</span>
                            <span className="text-[9px] text-muted-foreground/70 font-normal">KAMI JUAL</span>
                          </div>
                          <div className="mt-1 font-semibold text-base sm:text-lg tabular tracking-tight text-foreground">
                            {sellVal != null ? (
                              <>
                                <span className="text-xs text-muted-foreground/75 font-normal mr-1 select-none">
                                  Rp
                                </span>
                                <span>{sellVal.toLocaleString("id-ID")}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground font-normal text-sm">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Kartu: Spread/Margin & Stok */}
                    <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.marginPct != null && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular",
                              c.marginPct >= 0
                                ? "border-success/20 bg-success-muted text-success dark:bg-success/15 dark:text-success"
                                : "border-destructive/20 bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive"
                            )}
                          >
                            Margin {c.marginPct.toFixed(1).replace(".", ",")}%
                          </span>
                        )}
                        {spread != null && spread > 0 && (
                          <span className="text-[11px] text-muted-foreground tabular">
                            Spread Rp {spread.toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground text-[11px] tabular font-medium text-right shrink-0">
                        Stok:{" "}
                        <span className="text-foreground font-semibold">
                          {c.quantity.toLocaleString("id-ID")}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* Belum Absen + Kehadiran Hari Ini */}
      {flags.attendanceAll && (
        <div className="grid gap-6 @xl/main:grid-cols-2">
          <SectionCard
            title="Belum Absen Hari Ini"
            icon={<IconUserOff className="size-4" />}
            padded={false}
            className={overview.notYetAbsent.length > 0 ? "border-warning/30" : ""}
            action={
              overview.notYetAbsent.length > 0 ? (
                <Badge variant="warning">{overview.notYetAbsent.length} karyawan</Badge>
              ) : undefined
            }
          >
            {overview.notYetAbsent.length === 0 ? (
              <EmptyState title="✓ Semua karyawan sudah absen" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Cabang</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.notYetAbsent.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-sm text-foreground">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {u.name.charAt(0)}
                          </span>
                          <span>{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.branch?.name ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard
            title="Kehadiran Hari Ini"
            padded={false}
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/attendance">Lihat →</Link>
              </Button>
            }
          >
            {overview.todayAttendanceList.length === 0 ? (
              <EmptyState title="Belum ada presensi hari ini" />
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
                  {overview.todayAttendanceList.map((att) => (
                    <TableRow key={att.id}>
                      <TableCell className="font-medium text-sm text-foreground">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {att.user.name.charAt(0)}
                          </span>
                          <span>{att.user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {att.user.branch?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm font-mono tabular">
                        {att.checkIn ? formatJakartaTime(att.checkIn) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            att.status === "PRESENT"
                              ? "success"
                              : att.status === "LATE"
                                ? "warning"
                                : "soft"
                          }
                        >
                          {statusLabel[att.status] ?? att.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </div>
      )}

      {/* Bank Mutations + Bank Accounts */}
      {flags.bank && (
        <div className="grid gap-6 @xl/main:grid-cols-2">
          <SectionCard
            title="Mutasi Bank Terbaru"
            padded={false}
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/bank-accounts">Lihat →</Link>
              </Button>
            }
          >
            {overview.recentMutations.length === 0 ? (
              <EmptyState title="Belum ada mutasi bank" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank / Perusahaan</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recentMutations.map((mut) => {
                    const isCredit = mut.type === "CREDIT";
                    return (
                      <TableRow key={mut.id}>
                        <TableCell className="text-sm">
                          <div className="font-semibold text-foreground">
                            {mut.bankAccount.bankName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {mut.bankAccount.company.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isCredit ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-success/20 bg-success-muted px-2 py-0.5 text-xs font-semibold text-success dark:bg-success/15 dark:text-success">
                              <IconArrowUpRight className="size-3.5" />
                              Masuk
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive dark:bg-destructive/15 dark:text-destructive">
                              <IconArrowDownRight className="size-3.5" />
                              Keluar
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular text-right">
                          <MoneyDisplay
                            amount={mut.amount}
                            currency={mut.bankAccount.currency.code}
                            showSign
                            tone={isCredit ? "success" : "destructive"}
                            size="inline"
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs tabular">
                          {mut.createdAt.toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            timeZone: "Asia/Jakarta",
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard
            title="Rekening Bank Aktif"
            description={`${overview.bankAccounts.length} rekening${global ? " di semua PT" : ""}`}
            padded={false}
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/bank-accounts">Kelola →</Link>
              </Button>
            }
          >
            {overview.bankAccounts.length === 0 ? (
              <EmptyState title="Belum ada rekening bank aktif" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PT / Bank</TableHead>
                    <TableHead>Mata Uang</TableHead>
                    <TableHead className="text-right">Saldo Saat Ini</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.bankAccounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="text-sm">
                        <div className="font-semibold text-foreground">{acc.bankName}</div>
                        <div className="text-xs text-muted-foreground">{acc.company.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {acc.currency.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {dailyBalanceByAccount.has(acc.id) ? (
                          <MoneyDisplay
                            amount={dailyBalanceByAccount.get(acc.id)}
                            currency={acc.currency.code}
                            size="inline"
                          />
                        ) : (
                          <span className="text-muted-foreground font-normal text-xs">
                            Belum diisi
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </div>
      )}

      {/* KPI Monthly Results */}
      {flags.kpiAll && overview.kpiResults.length > 0 && (
        <SectionCard
          title="Hasil KPI Bulan Ini"
          description={`Top performers — ${now.toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          })}`}
          padded={false}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/kpi/log">Lihat Log →</Link>
            </Button>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Rank</TableHead>
                <TableHead>Karyawan</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead className="text-right">Pencapaian</TableHead>
                <TableHead className="text-center">Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.kpiResults.map((r, i) => {
                const rank = i + 1;
                const scorePct = Number(r.totalScore) * 100;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-center tabular">
                      {rank === 1 ? (
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-warning-muted text-warning-foreground font-bold text-xs border border-warning/30">
                          1
                        </span>
                      ) : rank === 2 ? (
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-foreground font-semibold text-xs border border-border">
                          2
                        </span>
                      ) : rank === 3 ? (
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted/60 text-muted-foreground font-semibold text-xs border border-border/60">
                          3
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">{rank}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-sm text-foreground">
                      {r.employee.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.employee.branch?.name ?? "-"}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      <span className="font-bold text-sm text-foreground">
                        {scorePct.toFixed(1).replace(".", ",")}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          r.grade === "A" || r.grade === "B"
                            ? "success"
                            : r.grade === "C"
                              ? "warning"
                              : "soft"
                        }
                      >
                        Grade {r.grade}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </>
  );
}
