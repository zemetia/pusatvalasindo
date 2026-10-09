"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
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
  MetricRow,
  MetricBlock,
  MetricLabel,
  MetricValue,
  DeltaPill,
} from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { IconChartHistogram } from "@tabler/icons-react";
import { formatPercent } from "@/lib/kpi-utils";
import { MonthPicker } from "./month-picker";
import {
  aggregatePerformance,
  NO_COMPANY,
  type RoleKpiSummary,
} from "@/lib/kpi-analytics";

const GRADE_VARIANT: Record<string, BadgeVariant> = {
  A: "success",
  B: "info",
  C: "warning",
  D: "destructive",
};

const ALL = "ALL";

export function RoleKpiSummaryClient({ summary }: { summary: RoleKpiSummary }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const { period, kpiColumns, rows, totals, byCompany, kpiAverages } = summary;

  const [company, setCompany] = useState(ALL);
  const [search, setSearch] = useState("");

  const setPeriod = (next: { month?: number; year?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(next.month ?? period.month));
    params.set("year", String(next.year ?? period.year));
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const companyOptions = useMemo(() => {
    if (byCompany && byCompany.length > 0) {
      return byCompany
        .map((c) => ({ value: c.key, label: c.label }))
        .sort((a, b) => a.label.localeCompare(b.label, "id"));
    }
    const map = new Map<string, string>();
    for (const r of rows) {
      const key = r.companyId ?? NO_COMPANY;
      const label = r.companyName || r.companyCode || "Tanpa PT";
      map.set(key, label);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [byCompany, rows]);

  const scoped = useMemo(
    () => (company === ALL ? rows : rows.filter((r) => (r.companyId ?? NO_COMPANY) === company)),
    [rows, company]
  );

  const scopedMetrics = useMemo(() => {
    if (company === ALL) {
      return { totals, kpiAverages };
    }
    const { totals: aggTotals } = aggregatePerformance(scoped);
    const kpiTotals = new Map<string, { sum: number; count: number }>();
    for (const r of scoped) {
      for (const item of r.kpis) {
        const prev = kpiTotals.get(item.name) ?? { sum: 0, count: 0 };
        prev.sum += item.achievement;
        prev.count += 1;
        kpiTotals.set(item.name, prev);
      }
    }
    const aggKpiAverages: Record<string, number | null> = {};
    for (const col of kpiColumns) {
      const entry = kpiTotals.get(col);
      aggKpiAverages[col] = entry && entry.count > 0 ? entry.sum / entry.count : null;
    }
    return { totals: aggTotals, kpiAverages: aggKpiAverages };
  }, [company, scoped, totals, kpiAverages, kpiColumns]);

  const activeTotals = scopedMetrics.totals;
  const activeKpiAverages = scopedMetrics.kpiAverages;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter(
      (r) => q === "" || [r.name, r.branchName, r.companyName].some((v) => v.toLowerCase().includes(q))
    );
  }, [scoped, search]);

  const canSplit = companyOptions.length > 1;

  return (
    <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
      {/* ── Filter ── */}
      <div className="flex flex-wrap items-end gap-3 pb-2">
        <div className="grid gap-1.5">
          <Label className="text-muted-foreground text-xs">Periode</Label>
          <MonthPicker
            month={period.month}
            year={period.year}
            onSelect={setPeriod}
          />
        </div>
        {canSplit && (
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground text-xs">PT</Label>
            <Combobox
              value={company}
              onValueChange={setCompany}
              options={[{ value: ALL, label: "Semua PT" }, ...companyOptions]}
              searchPlaceholder="Cari PT..."
              className="w-48"
            />
          </div>
        )}
        <Link
          href="/dashboard/kpi/analisis"
          className="text-muted-foreground hover:text-foreground ml-auto text-xs underline-offset-4 hover:underline"
        >
          Lihat semua jabatan di Analisis Kinerja
        </Link>
      </div>

      {/* ── Angka utama ── */}
      <section className="rounded-xl border bg-card p-5 shadow-xs flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <MetricLabel>Rata-rata Skor · {summary.roleName}</MetricLabel>
          <MetricValue size="hero" className="mt-2">
            {activeTotals.avgScore === null ? "—" : formatPercent(activeTotals.avgScore)}
          </MetricValue>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DeltaPill value={activeTotals.avgDeltaPct} />
            <span className="text-muted-foreground text-xs">vs bulan lalu</span>
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {period.label} ·{" "}
            {activeTotals.avgScore === null
              ? "belum ada karyawan yang dinilai pada jabatan ini"
              : `dihitung dari ${activeTotals.scored} dari ${activeTotals.employees} karyawan`}
          </p>
        </div>
      </section>

      <MetricRow columns={4} className="mt-6">
        <MetricBlock
          label="Sudah Dinilai"
          size="secondary"
          value={activeTotals.scored}
          suffix={`/ ${activeTotals.employees}`}
          progress={activeTotals.employees > 0 ? activeTotals.scored / activeTotals.employees : 0}
          meta="karyawan jabatan ini"
        />
        <MetricBlock
          label="Grade A–B"
          size="secondary"
          tone={activeTotals.gradeCounts.A + activeTotals.gradeCounts.B > 0 ? "success" : "muted"}
          value={activeTotals.gradeCounts.A + activeTotals.gradeCounts.B}
          progress={
            activeTotals.scored > 0
              ? (activeTotals.gradeCounts.A + activeTotals.gradeCounts.B) / activeTotals.scored
              : 0
          }
          meta="karyawan bergrade baik"
        />
        <MetricBlock
          label="Perlu Perhatian"
          size="secondary"
          tone={activeTotals.gradeCounts.D > 0 ? "destructive" : "muted"}
          value={activeTotals.gradeCounts.D}
          meta="karyawan bergrade D"
        />
        <MetricBlock
          label="Belum Dinilai"
          size="secondary"
          tone={activeTotals.unscored > 0 ? "warning" : "muted"}
          value={activeTotals.unscored}
          meta={activeTotals.unscored > 0 ? "skornya belum pernah dihitung" : "semua sudah dihitung"}
        />
      </MetricRow>

      {/* ── Rata-rata tiap KPI jabatan ini ── */}
      {kpiColumns.length > 0 && (
        <MetricRow
          title={`Rata-rata per KPI · ${period.label}`}
          columns={kpiColumns.length >= 3 ? 3 : 2}
          className="mt-6"
        >
          {kpiColumns.map((name) => (
            <MetricBlock
              key={name}
              label={name}
              size="secondary"
              value={
                activeKpiAverages[name] === null ? "—" : formatPercent(activeKpiAverages[name] as number)
              }
              progress={
                activeKpiAverages[name] !== null
                  ? (activeKpiAverages[name] as number)
                  : null
              }
              meta="rata-rata pencapaian"
            />
          ))}
        </MetricRow>
      )}

      <div className="mt-10 flex flex-col gap-6">
        <SectionCard
          title="Pencapaian per Karyawan"
          description={`${period.label} · ${kpiColumns.length} KPI berbobot pada jabatan ini`}
          padded={false}
          toolbar={
            <SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau cabang..." />
          }
          footer={`${filtered.length} dari ${rows.length} karyawan ditampilkan`}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Karyawan</TableHead>
                <TableHead>PT / Cabang</TableHead>
                {kpiColumns.map((name) => (
                  <TableHead key={name} className="text-right">
                    {name}
                  </TableHead>
                ))}
                <TableHead className="text-right">Skor Total</TableHead>
                <TableHead>vs Bulan Lalu</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={kpiColumns.length + 5} className="p-0">
                    <EmptyState
                      icon={<IconChartHistogram className="size-5" />}
                      title={rows.length === 0 ? "Belum ada karyawan jabatan ini" : "Tidak ada hasil"}
                      description={
                        rows.length === 0
                          ? "Belum ada karyawan aktif dengan jabatan ini."
                          : "Tidak ada karyawan yang cocok dengan pencarian ini."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.employeeId} className={r.score === null ? "opacity-60" : undefined}>
                    <TableCell>
                      <Link
                        href={`/dashboard/users/${r.employeeId}`}
                        className="font-medium hover:text-primary underline-offset-4 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.companyCode} · {r.branchName}
                    </TableCell>
                    {kpiColumns.map((name) => {
                      const v = r.kpiByName[name];
                      return (
                        <TableCell key={name} className="tabular text-right">
                          {v === undefined || v === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            formatPercent(v)
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="tabular text-right font-medium">
                      {r.score === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatPercent(r.score)
                      )}
                    </TableCell>
                    <TableCell>
                      <DeltaPill value={r.deltaPct} />
                    </TableCell>
                    <TableCell>
                      {r.grade ? (
                        <Badge variant={GRADE_VARIANT[r.grade] ?? "soft"}>{r.grade}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">belum dinilai</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>

        <p className="text-muted-foreground text-xs">
          Skor berasal dari hasil KPI yang sudah dihitung. Bandingkan jabatan lain di{" "}
          <Link href="/dashboard/kpi/analisis" className="text-foreground underline">
            Analisis Kinerja
          </Link>
          , atau ubah bobot KPI jabatan ini di{" "}
          <Link href="/dashboard/kpi" className="text-foreground underline">
            Konfigurasi KPI
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
