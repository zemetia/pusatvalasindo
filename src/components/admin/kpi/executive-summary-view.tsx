"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
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
  SectionCard,
  EmptyState,
} from "@/components/admin/page-shell";
import {
  IconBuildingStore,
  IconTrendingUp,
  IconUsersGroup,
  IconCash,
  IconTruck,
  IconCoin,
  IconBriefcase,
  IconChevronDown,
  IconChevronUp,
  IconRoute,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { formatPercent, formatCurrency } from "@/lib/kpi-utils";
import {
  buildExecutiveSummary,
  type CanonicalRoleCategory,
  type EmployeePerformance,
  type PeriodRef,
  type RoleSectionSummary,
} from "@/lib/kpi-analytics";

const GRADE_VARIANT: Record<string, BadgeVariant> = {
  A: "success",
  B: "info",
  C: "warning",
  D: "destructive",
};

const ROLE_ICONS: Record<CanonicalRoleCategory, React.ElementType> = {
  KEPALA_CABANG: IconBuildingStore,
  KEPALA_MARKETING: IconTrendingUp,
  MARKETING: IconUsersGroup,
  TELLER_LUAR: IconCash,
  KURIR: IconTruck,
  TELLER_DALAM: IconCoin,
  LAINNYA: IconBriefcase,
};

export function ExecutiveSummaryView({
  rows,
  period,
}: {
  rows: EmployeePerformance[];
  period: PeriodRef & { label: string };
}) {
  const summary = useMemo(() => buildExecutiveSummary(rows), [rows]);

  // Company selection state ("ALL" or companyCode)
  const [selectedCompany, setSelectedCompany] = useState<string>("ALL");

  // Per-company selected branch state
  const [branchFilter, setBranchFilter] = useState<Record<string, string>>({});

  // Collapsible Kurir logs per employee
  const [openKurirLogs, setOpenKurirLogs] = useState<Record<string, boolean>>({});

  const toggleKurirLog = (employeeId: string) => {
    setOpenKurirLogs((prev) => ({ ...prev, [employeeId]: !prev[employeeId] }));
  };

  const setCompanyBranch = (companyCode: string, branchId: string) => {
    setBranchFilter((prev) => ({ ...prev, [companyCode]: branchId }));
  };

  const displayedCompanies = useMemo(() => {
    if (selectedCompany === "ALL") return summary.companies;
    return summary.companies.filter((c) => c.companyCode === selectedCompany);
  }, [summary.companies, selectedCompany]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Filter navigasi perusahaan ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 p-1">
          <Button
            size="sm"
            variant={selectedCompany === "ALL" ? "default" : "ghost"}
            onClick={() => setSelectedCompany("ALL")}
            className="text-xs h-8"
          >
            Semua Perusahaan ({summary.companies.length})
          </Button>
          {summary.companies.map((c) => (
            <Button
              key={c.companyCode || c.companyId}
              size="sm"
              variant={selectedCompany === c.companyCode ? "default" : "ghost"}
              onClick={() => setSelectedCompany(c.companyCode)}
              className="text-xs h-8 gap-1.5"
            >
              <span>{c.companyName}</span>
              <span className="opacity-75 font-mono text-[0.7rem]">({c.companyCode})</span>
            </Button>
          ))}
        </div>

        <div className="text-muted-foreground text-xs">
          Periode: <span className="font-semibold text-foreground">{period.label}</span> · {summary.overallTotals.scoredCount} dari {summary.overallTotals.employeeCount} karyawan dinilai
        </div>
      </div>

      {/* ── Highlight Omzet & Kinerja Grup ── */}
      {summary.overallTotals.totalOmzetTarget > 0 && selectedCompany === "ALL" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border bg-card p-5 shadow-xs">
          <div>
            <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
              Total Realisasi Omzet (Grup)
            </span>
            <div className="text-xl font-bold tracking-tight text-primary mt-1">
              {formatCurrency(summary.overallTotals.totalOmzetActual)}
            </div>
            <span className="text-muted-foreground text-xs mt-1 block">
              dari target {formatCurrency(summary.overallTotals.totalOmzetTarget)}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
              Pencapaian Omzet Grup
            </span>
            <div className="text-xl font-bold tracking-tight mt-1 flex items-baseline gap-2">
              <span>
                {formatPercent(
                  summary.overallTotals.totalOmzetActual /
                    summary.overallTotals.totalOmzetTarget
                )}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (summary.overallTotals.totalOmzetActual /
                      summary.overallTotals.totalOmzetTarget) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div>
            <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
              Rata-rata Skor Kinerja
            </span>
            <div className="text-xl font-bold tracking-tight mt-1">
              {summary.overallTotals.avgScore !== null
                ? formatPercent(summary.overallTotals.avgScore)
                : "—"}
            </div>
            <span className="text-muted-foreground text-xs mt-1 block">
              lintas seluruh perusahaan
            </span>
          </div>

          <div>
            <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
              Kelengkapan Penilaian
            </span>
            <div className="text-xl font-bold tracking-tight mt-1">
              {summary.overallTotals.scoredCount}{" "}
              <span className="text-muted-foreground text-sm font-normal">
                / {summary.overallTotals.employeeCount} Karyawan
              </span>
            </div>
            <span className="text-muted-foreground text-xs mt-1 block">
              {formatPercent(
                summary.overallTotals.employeeCount > 0
                  ? summary.overallTotals.scoredCount /
                      summary.overallTotals.employeeCount
                  : 0
              )}{" "}
              sudah dinilai
            </span>
          </div>
        </div>
      )}

      {/* ── Rangkuman per Perusahaan ── */}
      {displayedCompanies.length === 0 ? (
        <EmptyState
          title="Belum ada data perusahaan"
          description="Data kinerja karyawan akan muncul setelah ada karyawan yang terdaftar pada periode ini."
        />
      ) : (
        displayedCompanies.map((company) => {
          const activeBranchId = branchFilter[company.companyCode] ?? "ALL";

          // Active branch data or company aggregated sections
          const currentSections: RoleSectionSummary[] =
            activeBranchId === "ALL"
              ? company.sections
              : company.branches.find((b) => b.branchId === activeBranchId)
                  ?.sections ?? [];

          const currentBranchName =
            activeBranchId === "ALL"
              ? "Semua Cabang"
              : company.branches.find((b) => b.branchId === activeBranchId)
                  ?.branchName ?? "Cabang";

          const currentOmzetTarget =
            activeBranchId === "ALL"
              ? company.totalOmzetTarget
              : company.branches.find((b) => b.branchId === activeBranchId)
                  ?.totalOmzetTarget ?? 0;

          const currentOmzetActual =
            activeBranchId === "ALL"
              ? company.totalOmzetActual
              : company.branches.find((b) => b.branchId === activeBranchId)
                  ?.totalOmzetActual ?? 0;

          const currentAvgScore =
            activeBranchId === "ALL"
              ? company.avgScore
              : company.branches.find((b) => b.branchId === activeBranchId)
                  ?.avgScore ?? null;

          return (
            <div
              key={company.companyCode || company.companyId}
              className="flex flex-col gap-6 rounded-2xl border bg-card/60 p-6 shadow-xs"
            >
              {/* Header Perusahaan */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                    {company.companyCode}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight">
                        {company.companyName}
                      </h2>
                      <Badge variant="outline" className="font-mono text-xs">
                        {company.companyCode}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {company.employeeCount} Personil · {currentBranchName}
                    </p>
                  </div>
                </div>

                {/* Sub-metrik ringkas perusahaan */}
                <div className="flex flex-wrap items-center gap-6">
                  {currentOmzetTarget > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total Omzet</div>
                      <div className="text-base font-bold text-primary">
                        {formatCurrency(currentOmzetActual)}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground tabular">
                          {formatPercent(currentOmzetActual / currentOmzetTarget)}
                        </span>
                        <span className="text-[0.75rem] tabular">
                          dari target {formatCurrency(currentOmzetTarget)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-right border-l pl-4">
                    <div className="text-xs text-muted-foreground">Pencapaian</div>
                    <div className="text-xl font-bold">
                      {currentAvgScore !== null ? formatPercent(currentAvgScore) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Selector Cabang jika perusahaan memiliki lebih dari 1 cabang */}
              {company.branches.length > 1 && (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs font-medium mr-1">
                      Pilih Cabang:
                    </span>
                    <Button
                      size="sm"
                      variant={activeBranchId === "ALL" ? "secondary" : "outline"}
                      onClick={() => setCompanyBranch(company.companyCode, "ALL")}
                      className="text-xs h-7"
                    >
                      Semua Cabang ({company.branches.length})
                    </Button>
                    {company.branches.map((b) => (
                      <Button
                        key={b.branchId}
                        size="sm"
                        variant={activeBranchId === b.branchId ? "secondary" : "outline"}
                        onClick={() => setCompanyBranch(company.companyCode, b.branchId)}
                        className="text-xs h-7 gap-1"
                      >
                        <span>{b.branchName}</span>
                        <span className="text-muted-foreground text-[0.7rem]">
                          ({b.employeeCount})
                        </span>
                      </Button>
                    ))}
                  </div>

                  {activeBranchId === "ALL" && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                      {company.branches.map((b) => (
                        <div
                          key={b.branchId}
                          onClick={() => setCompanyBranch(company.companyCode, b.branchId)}
                          className="group flex flex-col justify-between rounded-xl border bg-muted/20 p-3.5 hover:bg-muted/40 hover:border-primary/50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                              Cabang {b.branchName}
                            </span>
                            <Badge variant="outline" className="text-[0.7rem]">
                              {b.employeeCount} Personil
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-baseline justify-between text-xs">
                            <span className="text-muted-foreground">Rata-rata Skor:</span>
                            <span className="font-bold text-foreground">
                              {b.avgScore !== null ? formatPercent(b.avgScore) : "—"}
                            </span>
                          </div>
                          {b.totalOmzetTarget > 0 && (
                            <div className="mt-1 flex items-baseline justify-between text-xs">
                              <span className="text-muted-foreground">Omzet Realisasi:</span>
                              <span className="font-semibold text-primary">
                                {formatCurrency(b.totalOmzetActual)}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Konten Bagian per Jabatan Standar */}
              {currentSections.length === 0 ? (
                <EmptyState
                  title="Belum ada data jabatan"
                  description="Tidak ada karyawan berjabatan yang aktif pada cabang ini."
                />
              ) : (
                <div className="grid gap-6">
                  {currentSections.map((section) => (
                    <RoleSectionCard
                      key={section.category}
                      section={section}
                      openKurirLogs={openKurirLogs}
                      toggleKurirLog={toggleKurirLog}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function OmzetValueCell({
  actual,
  target,
  achievement,
  align = "right",
}: {
  actual: number | null | undefined;
  target: number | null | undefined;
  achievement: number | null | undefined;
  align?: "left" | "right";
}) {
  const hasActual = actual !== null && actual !== undefined;
  const hasTarget = target !== null && target !== undefined && target > 0;

  if (!hasActual && !hasTarget) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const isSuspicious = hasActual && actual === 1 && hasTarget && (target ?? 0) > 1000;
  const isZeroNoData = hasActual && actual === 0 && hasTarget;

  return (
    <div
      className={`flex flex-col ${
        align === "right" ? "items-end text-right" : "items-start text-left"
      } gap-0.5`}
    >
      {/* 1. Value Omzet */}
      <div className="font-semibold text-sm tabular text-foreground">
        {hasActual ? (
          isSuspicious ? (
            <span className="text-amber-600 dark:text-amber-400 font-mono text-xs">
              1 (Nilai Belum Valid)
            </span>
          ) : isZeroNoData ? (
            <span className="text-muted-foreground font-mono">Rp 0</span>
          ) : (
            formatCurrency(actual)
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      {/* 2. Di bawahnya: Percentage dari target */}
      {hasTarget ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {achievement !== null && achievement !== undefined ? (
            <span
              className={`font-semibold tabular ${
                achievement >= 1
                  ? "text-emerald-600 dark:text-emerald-400"
                  : achievement > 0
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {formatPercent(achievement)}
            </span>
          ) : null}
          <span className="text-[0.75rem] tabular">
            dari target {formatCurrency(target)}
          </span>
          {isZeroNoData && (
            <span className="text-destructive text-[0.65rem] italic">(belum diisi)</span>
          )}
          {isSuspicious && (
            <span className="text-amber-600 dark:text-amber-400 text-[0.65rem] italic">
              (perlu diverifikasi)
            </span>
          )}
        </div>
      ) : hasActual ? (
        <span className="text-muted-foreground text-[0.7rem]">(tanpa target terpisah)</span>
      ) : null}
    </div>
  );
}

function RoleSectionCard({
  section,
  openKurirLogs,
  toggleKurirLog,
}: {
  section: RoleSectionSummary;
  openKurirLogs: Record<string, boolean>;
  toggleKurirLog: (employeeId: string) => void;
}) {
  const Icon = ROLE_ICONS[section.category] ?? IconBriefcase;

  const hasOmzetSection =
    section.totalTarget > 0 ||
    section.totalActual > 0 ||
    section.category === "KEPALA_CABANG" ||
    section.category === "KEPALA_MARKETING" ||
    section.category === "MARKETING" ||
    section.category === "TELLER_LUAR";

  return (
    <SectionCard
      title={
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-muted text-foreground">
            <Icon className="size-4" />
          </div>
          <span>{section.title}</span>
          <Badge variant="outline" className="text-xs font-normal">
            {section.employees.length} personil
          </Badge>
        </div>
      }
      description={
        section.category === "MARKETING"
          ? "Pencapaian tim marketing dan kontribusi omzet personil."
          : section.category === "KURIR"
          ? "Pencapaian pengiriman, hari aktif, dan ringkasan rute dari catatan log."
          : `Rangkuman kinerja jabatan ${section.title} untuk periode aktif.`
      }
      padded={false}
    >
      {/* ── 2 Box Metrik Utama: PENCAPAIAN dan TOTAL OMZET ── */}
      <div className="grid gap-3 sm:grid-cols-2 p-4 bg-muted/20 border-b">
        {/* Box 1: PENCAPAIAN */}
        <div className="flex flex-col justify-between rounded-xl border bg-card p-3.5 shadow-2xs">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.category === "KURIR" ? "Pencapaian Persentase" : "Pencapaian"}
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {section.avgScore !== null ? formatPercent(section.avgScore) : "—"}
            </span>
            <Badge variant="outline" className="text-xs">
              {section.employees.length} personil
            </Badge>
          </div>
          <span className="text-muted-foreground text-[0.75rem] mt-1">
            {section.category === "KURIR"
              ? "Rata-rata skor ketepatan pengiriman & SOP kurir"
              : `Rata-rata skor kinerja ${section.title}`}
          </span>
        </div>

        {/* Box 2: TOTAL OMZET (Value di atas, Percentage dari Target di bawah) */}
        {hasOmzetSection && section.category !== "KURIR" && (
          <div className="flex flex-col justify-between rounded-xl border bg-card p-3.5 shadow-2xs">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Omzet
            </span>
            <div className="mt-1">
              <span className="text-2xl font-bold tracking-tight text-primary">
                {formatCurrency(section.totalActual)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
              {section.totalTarget > 0 ? (
                <>
                  <span
                    className={`font-bold tabular ${
                      (section.omzetAchievement ?? 0) >= 1
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground"
                    }`}
                  >
                    {section.omzetAchievement !== null
                      ? formatPercent(section.omzetAchievement)
                      : "0%"}
                  </span>
                  <span className="text-muted-foreground text-[0.75rem] tabular">
                    dari target {formatCurrency(section.totalTarget)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-[0.75rem]">
                  Target omzet belum ditentukan
                </span>
              )}
            </div>
          </div>
        )}

        {/* Box 2 Khusus Kurir: PENGIRIMAN & BREAKDOWN RUTE */}
        {section.category === "KURIR" && (
          <div className="flex flex-col justify-between rounded-xl border bg-card p-3.5 shadow-2xs">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Pengiriman & Rute
            </span>
            <div className="mt-1">
              <span className="text-2xl font-bold tracking-tight text-primary">
                {section.kurirTotalVolume ?? 0}{" "}
                <span className="text-sm font-normal text-muted-foreground">paket</span>
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <IconCalendarEvent className="size-3.5 text-muted-foreground" />
              <span>{section.kurirTotalActiveDays ?? 0} hari aktif total</span>
              <span>·</span>
              <span>Breakdown rute per kurir di bawah</span>
            </div>
          </div>
        )}

        {/* Box 2 Khusus Teller Dalam */}
        {section.category === "TELLER_DALAM" && (
          <div className="flex flex-col justify-between rounded-xl border bg-card p-3.5 shadow-2xs">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Operasional Kas & Closing
            </span>
            <div className="mt-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {section.employees.length}{" "}
                <span className="text-sm font-normal text-muted-foreground">teller aktif</span>
              </span>
            </div>
            <span className="text-muted-foreground text-[0.75rem] mt-1">
              Kepatuhan closing tepat waktu & toleransi kas
            </span>
          </div>
        )}
      </div>

      {/* ── 1. Tampilan Khusus MARKETING (Tim & Kontribusi Personil) ── */}
      {section.category === "MARKETING" && section.marketingContributions && (
        <div className="flex flex-col">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Personil Marketing</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead className="text-right">Pencapaian</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Total Omzet</TableHead>
                <TableHead className="w-48 text-right">Kontribusi ke Tim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.marketingContributions.map((m, idx) => (
                <TableRow key={m.employeeId}>
                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/users/${m.employeeId}`}
                      className="hover:text-primary underline-offset-4 hover:underline"
                    >
                      {m.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {m.branchName}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular">
                    {m.score !== null ? formatPercent(m.score) : "—"}
                  </TableCell>
                  <TableCell>
                    {m.grade ? (
                      <Badge variant={GRADE_VARIANT[m.grade] ?? "soft"}>{m.grade}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <OmzetValueCell
                      actual={m.actual}
                      target={m.target}
                      achievement={m.achievement}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${Math.min(100, m.contributionPct)}%` }}
                        />
                      </div>
                      <span className="tabular text-xs font-semibold w-12 text-right">
                        {m.contributionPct.toFixed(1).replace(".", ",")}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── 2. Tampilan Khusus KURIR (Pengiriman, Hari Aktif & Rute) ── */}
      {section.category === "KURIR" && (
        <div className="flex flex-col divide-y">
          {section.employees.map((k) => {
            const ks = k.kurirSummary;
            const isOpen = !!openKurirLogs[k.employeeId];

            return (
              <div key={k.employeeId} className="p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                      {k.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/users/${k.employeeId}`}
                          className="font-semibold hover:text-primary underline-offset-4 hover:underline"
                        >
                          {k.name}
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          {k.branchName}
                        </Badge>
                        {k.grade && (
                          <Badge variant={GRADE_VARIANT[k.grade] ?? "soft"}>
                            Grade {k.grade}
                          </Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground text-xs">
                        Pencapaian KPI:{" "}
                        <span className="font-semibold text-foreground">
                          {k.score !== null ? formatPercent(k.score) : "—"}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Metrik Kurir */}
                  <div className="flex flex-wrap items-center gap-5 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs block">Volume Pengiriman</span>
                      <span className="font-bold text-foreground">
                        {ks ? ks.totalVolume : 0} paket
                      </span>
                      {ks?.deliveryTarget && (
                        <span className="text-muted-foreground text-xs ml-1">
                          / target {ks.deliveryTarget}
                        </span>
                      )}
                    </div>

                    <div className="border-l pl-4">
                      <span className="text-muted-foreground text-xs block">Hari Aktif</span>
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <IconCalendarEvent className="size-3.5 text-muted-foreground" />
                        {ks ? ks.activeDays : 0} hari
                      </span>
                    </div>

                    {ks?.deliveryAchievement !== null && ks?.deliveryAchievement !== undefined && (
                      <div className="border-l pl-4">
                        <span className="text-muted-foreground text-xs block">Ketepatan</span>
                        <Badge variant="success" className="text-xs">
                          {formatPercent(ks.deliveryAchievement)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ringkasan Rute dari catatan log KpiEntry */}
                <div className="rounded-lg bg-muted/40 p-3 mt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    <IconRoute className="size-3.5" />
                    <span>Breakdown Rute Pengiriman (Log KpiEntry)</span>
                  </div>

                  {ks && ks.routes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {ks.routes.map((r) => (
                        <Badge
                          key={r.route}
                          variant="secondary"
                          className="text-xs py-1 px-2.5 font-normal flex items-center gap-1.5"
                        >
                          <span className="font-medium text-foreground">{r.route}</span>
                          <span className="text-muted-foreground text-[0.7rem] bg-background/80 rounded px-1.5 py-0.2">
                            {r.count}x trip ({r.volume} paket)
                          </span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">
                      Belum ada catatan rute spesifik yang dicatat pada entri bulan ini.
                    </p>
                  )}

                  {/* Tombol buka log harian */}
                  {ks && ks.recentLogs.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/50">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleKurirLog(k.employeeId)}
                        className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1 px-2"
                      >
                        {isOpen ? (
                          <>
                            <IconChevronUp className="size-3.5" />
                            <span>Tutup Catatan Rute Harian</span>
                          </>
                        ) : (
                          <>
                            <IconChevronDown className="size-3.5" />
                            <span>Lihat Catatan Rute Harian ({ks.recentLogs.length} catatan terbaru)</span>
                          </>
                        )}
                      </Button>

                      {isOpen && (
                        <div className="mt-2 rounded-md border bg-background overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50 text-[0.7rem]">
                                <TableHead className="w-28">Tanggal</TableHead>
                                <TableHead className="w-24 text-right">Volume</TableHead>
                                <TableHead>Catatan / Rute Pengiriman</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="text-xs">
                              {ks.recentLogs.map((log, i) => (
                                <TableRow key={i}>
                                   <TableCell className="text-muted-foreground tabular font-mono">
                                    {log.date}
                                  </TableCell>
                                  <TableCell className="text-right font-medium tabular">
                                    {log.quantity}
                                  </TableCell>
                                  <TableCell className="font-medium text-foreground">
                                    {log.note}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. Tampilan Jabatan Lainnya (Kepala Cabang, Kepala Marketing, Teller Luar, Teller Dalam, dll) ── */}
      {section.category !== "MARKETING" && section.category !== "KURIR" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Personil</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead className="text-right">Pencapaian</TableHead>
              <TableHead>Grade</TableHead>
              {hasOmzetSection && (
                <TableHead className="text-right">Total Omzet</TableHead>
              )}
              <TableHead>Fokus Utama</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {section.employees.map((emp, idx) => (
              <TableRow key={emp.employeeId}>
                <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/users/${emp.employeeId}`}
                    className="hover:text-primary underline-offset-4 hover:underline"
                  >
                    {emp.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {emp.branchName}
                </TableCell>
                <TableCell className="text-right font-medium tabular">
                  {emp.score !== null ? formatPercent(emp.score) : "—"}
                </TableCell>
                <TableCell>
                  {emp.grade ? (
                    <Badge variant={GRADE_VARIANT[emp.grade] ?? "soft"}>{emp.grade}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                {hasOmzetSection && (
                  <TableCell className="text-right">
                    <OmzetValueCell
                      actual={emp.omzetActual}
                      target={emp.omzetTarget}
                      achievement={emp.omzetAchievement}
                    />
                  </TableCell>
                )}
                <TableCell className="text-xs text-muted-foreground">
                  {emp.kpis[0] ? (
                    <span>
                      {emp.kpis[0].name} ({formatPercent(emp.kpis[0].achievement)})
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
