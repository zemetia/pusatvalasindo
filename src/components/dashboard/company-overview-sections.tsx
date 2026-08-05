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
import { IconArrowUpRight, IconArrowDownRight, IconAlertTriangle, IconUserOff, IconClockCheck } from "@tabler/icons-react";
import { SectionCard, EmptyState, MetricRow, MetricBlock, MetricLabel, DeltaPill } from "@/components/admin/page-shell";
import {
  fmtRate,
  fmtCurrency,
  fmtAmount,
  currencySymbol,
  latestBalanceByAccount,
  statusLabel,
  type CompanyOverviewFlags,
  type CurrencyCard,
  type BankCurrencyGroup,
  type getCompanyOverview,
} from "@/backend/services/dashboard-data.service";

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

  const showBentoOverview = flags.usersCount || flags.branchesCount || flags.attendanceAll || flags.kpiAll || flags.bank || flags.payrollTeam;

  return (
    <>
      {/* Alert: Presensi Mencurigakan */}
      {flags.suspicious && overview.suspectAttendance.length > 0 && (
        <Card className="border-warning/40 gap-0 overflow-hidden py-0">
          <CardHeader className="bg-warning-muted/60 border-b py-4">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="text-warning size-5" />
              <CardTitle className="text-warning-foreground text-sm">
                Presensi Lokasi Mencurigakan — {overview.suspectAttendance.length} karyawan
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
                {overview.suspectAttendance.map((att) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium text-sm">{att.user.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{att.user.branch?.name ?? "-"}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {att.checkIn ? att.checkIn.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
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
        <Card className="border-info/40 gap-0 overflow-hidden py-0">
          <CardHeader className="bg-info-muted/60 border-b py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconClockCheck className="text-info size-5" />
                <CardTitle className="text-sm">Pengajuan Koreksi Menunggu — {overview.pendingCorrections.length}</CardTitle>
              </div>
              {canApproveCorrections && (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/persetujuan-koreksi">Tinjau →</Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Nilai Saat Ini</TableHead>
                  <TableHead className="text-right">Usulan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.pendingCorrections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.targetLabel}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtRate(c.currentValue)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtRate(c.proposedValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Ringkasan Bisnis — metrik utama, dipisah garis rambut bukan kartu */}
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
                  {primaryBankGroup.filledCount < primaryBankGroup.count
                    ? `${primaryBankGroup.filledCount} dari ${primaryBankGroup.count} rekening ${primaryBankGroup.code} terisi`
                    : `${primaryBankGroup.count} rekening ${primaryBankGroup.code}`}
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
              suffix={`dari ${overview.totalUsers}`}
              meta={overview.attendancePct != null ? `${overview.attendancePct.toFixed(0)}% karyawan hadir` : "Belum ada data kehadiran"}
            />
          )}

          {flags.kpiAll && (
            <MetricBlock
              label="KPI Bulan Ini"
              value={overview.kpiAvgThisMonth != null ? overview.kpiAvgThisMonth.toFixed(1) : overview.kpiLogsThisMonth}
              delta={overview.kpiTrendPct}
              period="vs bulan lalu"
              meta={
                overview.kpiAvgThisMonth != null
                  ? `Rata-rata skor tim · ${overview.kpiLogsThisMonth} entri`
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
              period={`${overview.highPerformersThisMonth} skor ≥80% vs bulan lalu`}
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
            <MetricBlock label="Karyawan Aktif" size="secondary" value={overview.totalUsers.toLocaleString("id-ID")} meta="Total karyawan terdaftar" />
          )}
          {flags.branchesCount && (
            <MetricBlock label="Cabang Aktif" size="secondary" value={overview.totalBranches.toLocaleString("id-ID")} meta="Cabang beroperasi" />
          )}
        </MetricRow>
      )}

      {/* Currency Rates */}
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
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 @2xl/main:grid-cols-3">
              {currencyCards.map((c) => (
                <div key={c.currencyId} className="border-border border-t pt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="font-mono text-sm font-medium">{c.code}</span>
                      <span className="text-muted-foreground truncate text-xs">{c.name}</span>
                    </div>
                    <DeltaPill value={c.trendPct} />
                  </div>
                  <div className="mt-3 flex items-start gap-8">
                    <div>
                      <MetricLabel>Beli</MetricLabel>
                      <p className="tabular mt-1 text-xl leading-none font-semibold tracking-tight">{fmtRate(c.avgBuy)}</p>
                    </div>
                    <div>
                      <MetricLabel>Jual</MetricLabel>
                      <p className="tabular mt-1 text-xl leading-none font-semibold tracking-tight">{fmtRate(c.avgSell)}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-3 text-xs">
                    {c.branchCount} cabang · stok {c.quantity.toLocaleString("id-ID")}
                    {c.marginPct != null && (
                      <>
                        {" · "}
                        <span className="text-foreground font-medium">margin {c.marginPct.toFixed(1).replace(".", ",")}%</span>
                      </>
                    )}
                  </p>
                </div>
              ))}
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
            className={overview.notYetAbsent.length > 0 ? "border-warning/40" : ""}
            action={overview.notYetAbsent.length > 0 ? <Badge variant="warning">{overview.notYetAbsent.length} karyawan</Badge> : undefined}
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
                      <TableCell className="font-medium text-sm">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.branch?.name ?? "-"}</TableCell>
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
                      <TableCell className="font-medium text-sm">{att.user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{att.user.branch?.name ?? "-"}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {att.checkIn ? att.checkIn.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={att.status === "PRESENT" ? "success" : att.status === "LATE" ? "warning" : "soft"}>
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
                    <TableHead>Bank / Cabang</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recentMutations.map((mut) => (
                    <TableRow key={mut.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{mut.bankAccount.bankName}</div>
                        <div className="text-xs text-muted-foreground">{mut.bankAccount.company.name}</div>
                      </TableCell>
                      <TableCell>
                        {mut.type === "CREDIT" ? (
                          <span className="text-success flex items-center gap-1 text-sm font-medium">
                            <IconArrowUpRight className="size-3.5" />
                            Masuk
                          </span>
                        ) : (
                          <span className="text-destructive flex items-center gap-1 text-sm font-medium">
                            <IconArrowDownRight className="size-3.5" />
                            Keluar
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right">{fmtCurrency(mut.amount, mut.bankAccount.currency.code)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {mut.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                      </TableCell>
                    </TableRow>
                  ))}
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
                    <TableHead>PT</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Mata Uang</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.bankAccounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="text-sm">{acc.company.name}</TableCell>
                      <TableCell className="font-medium text-sm">{acc.bankName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {acc.currency.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {dailyBalanceByAccount.has(acc.id) ? (
                          fmtCurrency(dailyBalanceByAccount.get(acc.id), acc.currency.code)
                        ) : (
                          <span className="text-muted-foreground font-normal">Belum diisi</span>
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
          description={`Top performers — ${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`}
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
                <TableHead className="w-10">#</TableHead>
                <TableHead>Karyawan</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead className="text-right">Total Skor</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.kpiResults.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground tabular">{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.employee.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.employee.branch?.name ?? "-"}</TableCell>
                  <TableCell className="tabular text-right font-medium">{(Number(r.totalScore) * 100).toFixed(1)}%</TableCell>
                  <TableCell>
                    <Badge variant={r.grade === "A" || r.grade === "B" ? "success" : "soft"}>{r.grade}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </>
  );
}
