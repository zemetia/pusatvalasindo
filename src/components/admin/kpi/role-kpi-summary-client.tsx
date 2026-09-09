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
import { MONTH_NAMES, formatPercent } from "@/lib/kpi-utils";
import { NO_COMPANY, type RoleKpiSummary } from "@/lib/kpi-analytics";

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

  const { period, kpiColumns, kpiAverages, rows, totals, byCompany } = summary;

  const [company, setCompany] = useState(ALL);
  const [search, setSearch] = useState("");

  const setPeriod = (next: { month?: number; year?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(next.month ?? period.month));
    params.set("year", String(next.year ?? period.year));
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const companyOptions = useMemo(
    () =>
      byCompany
        .map((c) => ({ value: c.key, label: c.label }))
        .sort((a, b) => a.label.localeCompare(b.label, "id")),
    [byCompany]
  );

  const scoped = useMemo(
    () => (company === ALL ? rows : rows.filter((r) => (r.companyId ?? NO_COMPANY) === company)),
    [rows, company]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter(
      (r) => q === "" || [r.name, r.branchName, r.companyName].some((v) => v.toLowerCase().includes(q))
    );
  }, [scoped, search]);

  const canSplit = byCompany.length > 1;

  return (
    <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
      {/* ── Filter ── */}
      <div className="flex flex-wrap items-end gap-3 pb-2">
        <div className="grid gap-1.5">
          <Label className="text-muted-foreground text-xs">Bulan</Label>
          <Combobox
            value={String(period.month)}
            onValueChange={(v) => setPeriod({ month: Number(v) })}
            options={MONTH_NAMES.slice(1).map((name, i) => ({
              value: String(i + 1),
              label: name,
            }))}
            searchPlaceholder="Cari bulan..."
            className="w-36"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-muted-foreground text-xs">Tahun</Label>
          <Combobox
            value={String(period.year)}
            onValueChange={(v) => setPeriod({ year: Number(v) })}
            options={Array.from({ length: 5 }, (_, i) => period.year - 2 + i).map((y) => ({
              value: String(y),
              label: String(y),
            }))}
            className="w-24"
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
      <section className="border-border flex flex-wrap items-end justify-between gap-6 border-y py-8">
        <div className="min-w-0">
          <MetricLabel>Rata-rata Skor · {summary.roleName}</MetricLabel>
          <MetricValue size="hero" className="mt-2">
            {totals.avgScore === null ? "—" : formatPercent(totals.avgScore)}
          </MetricValue>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DeltaPill value={totals.avgDeltaPct} />
            <span className="text-muted-foreground text-xs">vs bulan lalu</span>
          </div>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {period.label} ·{" "}
            {totals.avgScore === null
              ? "belum ada karyawan yang dinilai pada jabatan ini"
              : `dihitung dari ${totals.scored} dari ${totals.employees} karyawan`}
          </p>
        </div>
      </section>

      <MetricRow columns={4} className="-mt-px">
        <MetricBlock
          label="Sudah Dinilai"
          size="secondary"
          value={totals.scored}
          suffix={`/ ${totals.employees}`}
          meta="karyawan jabatan ini"
        />
        <MetricBlock
          label="Grade A–B"
          size="secondary"
          tone={totals.gradeCounts.A + totals.gradeCounts.B > 0 ? "success" : "muted"}
          value={totals.gradeCounts.A + totals.gradeCounts.B}
          meta="karyawan bergrade baik"
        />
        <MetricBlock
          label="Perlu Perhatian"
          size="secondary"
          tone={totals.gradeCounts.D > 0 ? "destructive" : "muted"}
          value={totals.gradeCounts.D}
          meta="karyawan bergrade D"
        />
        <MetricBlock
          label="Belum Dinilai"
          size="secondary"
          tone={totals.unscored > 0 ? "warning" : "muted"}
          value={totals.unscored}
          meta={totals.unscored > 0 ? "skornya belum pernah dihitung" : "semua sudah dihitung"}
        />
      </MetricRow>

      {/* ── Rata-rata tiap KPI jabatan ini ── */}
      {kpiColumns.length > 0 && (
        <MetricRow
          title={`Rata-rata per KPI · ${period.label}`}
          columns={kpiColumns.length >= 3 ? 3 : 2}
          className="-mt-px"
        >
          {kpiColumns.map((name) => (
            <MetricBlock
              key={name}
              label={name}
              size="secondary"
              value={
                kpiAverages[name] === null ? "—" : formatPercent(kpiAverages[name] as number)
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
