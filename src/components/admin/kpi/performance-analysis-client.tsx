"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { PerformanceOverview } from "@/backend/services/kpi-analytics.service";

/* ── Skala bersama untuk sparkline ──────────────────────────────────────────
 * Domain sama untuk semua baris (bukan min–max tiap baris) supaya garisnya bisa
 * dibandingkan langsung: karyawan yang datar di 50% harus terlihat lebih rendah
 * daripada yang datar di 95%, bukan sama-sama garis lurus. Puncaknya 120%, tapi
 * ikut naik bila ada yang melampaui — skor tidak berplafon, jadi mematoknya
 * membuat 180% dan 120% tergambar sama tinggi.
 */
const SPARK_BASE_MAX = 1.2;
const SPARK_W = 72;
const SPARK_H = 20;

function Sparkline({
  values,
  labels,
  max,
}: {
  values: (number | null)[];
  labels: string[];
  max: number;
}) {
  const points = values.map((v, i) => ({
    x: values.length <= 1 ? SPARK_W / 2 : (i / (values.length - 1)) * SPARK_W,
    y: v === null ? null : SPARK_H - (Math.max(v, 0) / max) * SPARK_H,
  }));

  // Bulan tanpa hasil memutus garis, bukan digambar sebagai nol — nol berarti
  // "dinilai dan hasilnya buruk", sedangkan kosong berarti "belum dinilai".
  const segments: string[] = [];
  let run: string[] = [];
  for (const p of points) {
    if (p.y === null) {
      if (run.length > 1) segments.push(`M ${run.join(" L ")}`);
      run = [];
    } else {
      run.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    }
  }
  if (run.length > 1) segments.push(`M ${run.join(" L ")}`);

  const last = [...points].reverse().find((p) => p.y !== null);
  const filled = values.filter((v) => v !== null).length;

  if (filled === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="text-primary overflow-visible"
      role="img"
      aria-label={`Tren ${labels.join(", ")}: ${values
        .map((v) => (v === null ? "belum dinilai" : formatPercent(v)))
        .join(", ")}`}
    >
      {segments.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {last?.y !== null && last !== undefined && (
        <circle cx={last.x} cy={last.y} r="1.75" fill="currentColor" />
      )}
    </svg>
  );
}

/* ── Pemetaan grade → token semantik ───────────────────────────────────────── */

const GRADE_VARIANT: Record<string, BadgeVariant> = {
  A: "success",
  B: "info",
  C: "warning",
  D: "destructive",
};

/** Warna segmen batang distribusi — token semantik, bukan hex mentah. */
const GRADE_BAR: Record<string, string> = {
  A: "bg-success",
  B: "bg-info",
  C: "bg-warning",
  D: "bg-destructive",
};

const GRADE_ORDER = ["A", "B", "C", "D"] as const;

type SortKey = "skor-desc" | "skor-asc" | "delta-desc" | "delta-asc" | "nama";

const SORT_LABELS: Record<SortKey, string> = {
  "skor-desc": "Skor tertinggi",
  "skor-asc": "Skor terendah",
  "delta-desc": "Kenaikan terbesar",
  "delta-asc": "Penurunan terbesar",
  nama: "Nama A–Z",
};

export function PerformanceAnalysisClient({ overview }: { overview: PerformanceOverview }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [company, setCompany] = useState("ALL");
  const [role, setRole] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("skor-desc");

  const { period, historyLabels, totals, byCompany, byRole, rows } = overview;

  /** Ganti periode = data baru dari server, jadi lewat URL bukan state lokal. */
  const setPeriod = (next: { month?: number; year?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(next.month ?? period.month));
    params.set("year", String(next.year ?? period.year));
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const roleOptions = useMemo(
    () => [...new Set(rows.map((r) => r.roleName))].sort(),
    [rows]
  );

  /**
   * Puncak skala sparkline: 120% kecuali ada yang melampauinya. Dihitung dari
   * seluruh baris (bukan hasil filter) supaya skalanya tidak bergeser saat
   * memfilter, dan diturunkan sebagai satu angka ke semua baris supaya tetap
   * bisa dibandingkan antar karyawan.
   */
  const sparkMax = useMemo(() => {
    const scores = rows.flatMap((r) => r.history.filter((v): v is number => v !== null));
    return Math.max(SPARK_BASE_MAX, ...scores);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (company === "ALL" || r.companyId === company) &&
        (role === "ALL" || r.roleName === role) &&
        (q === "" ||
          [r.name, r.roleName, r.branchName, r.companyName].some((v) =>
            v.toLowerCase().includes(q)
          ))
    );

    /**
     * Yang belum punya angka selalu ditaruh di akhir — menyelipkannya di tengah
     * membuat peringkat salah dibaca. Dua baris yang sama-sama kosong dianggap
     * seri lalu diurut nama, bukan dikurangkan (Infinity − Infinity = NaN, dan
     * komparator NaN membuat urutannya berubah-ubah tiap render).
     */
    const byValue = (
      a: number | null,
      b: number | null,
      dir: 1 | -1,
      tieBreak: () => number
    ) => {
      if (a === null && b === null) return tieBreak();
      if (a === null) return 1;
      if (b === null) return -1;
      return a === b ? tieBreak() : dir * (a - b);
    };

    return [...list].sort((a, b) => {
      const byName = () => a.name.localeCompare(b.name, "id");
      switch (sort) {
        case "skor-asc":
          return byValue(a.score, b.score, 1, byName);
        case "delta-desc":
          return byValue(a.deltaPct, b.deltaPct, -1, byName);
        case "delta-asc":
          return byValue(a.deltaPct, b.deltaPct, 1, byName);
        case "nama":
          return byName();
        default:
          return byValue(a.score, b.score, -1, byName);
      }
    });
  }, [rows, company, role, search, sort]);

  const goodCount = totals.gradeCounts.A + totals.gradeCounts.B;
  const gradeTotal = GRADE_ORDER.reduce((sum, g) => sum + totals.gradeCounts[g], 0);

  return (
    <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
      {/* ── Pemilih periode ── */}
      <div className="flex flex-wrap items-end gap-3 pb-2">
        <div className="grid gap-1.5">
          <Label className="text-muted-foreground text-xs">Bulan</Label>
          <Select
            value={String(period.month)}
            onValueChange={(v) => setPeriod({ month: Number(v) })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.slice(1).map((name, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-muted-foreground text-xs">Tahun</Label>
          <Select
            value={String(period.year)}
            onValueChange={(v) => setPeriod({ year: Number(v) })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => period.year - 2 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Angka utama halaman ── */}
      <section className="border-border border-y py-8">
        <MetricLabel>Rata-rata Skor Seluruh Karyawan</MetricLabel>
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
            ? "belum ada karyawan yang dinilai pada periode ini"
            : `dihitung dari ${totals.scored} karyawan yang sudah dinilai`}
        </p>
      </section>

      <MetricRow columns={4} className="-mt-px">
        <MetricBlock
          label="Sudah Dinilai"
          size="secondary"
          value={totals.scored}
          suffix={`/ ${totals.employees}`}
          meta="karyawan aktif berjabatan"
        />
        <MetricBlock
          label="Grade A–B"
          size="secondary"
          tone={goodCount > 0 ? "success" : "muted"}
          value={goodCount}
          meta={
            gradeTotal > 0
              ? `${formatPercent(goodCount / gradeTotal, 0)} dari yang dinilai`
              : "belum ada penilaian"
          }
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
          meta={
            totals.unscored > 0 ? "skornya belum pernah dihitung" : "semua sudah dihitung"
          }
        />
      </MetricRow>

      {/* ── Distribusi grade ── */}
      {gradeTotal > 0 && (
        <section className="border-border -mt-px flex flex-col gap-4 border-y py-8">
          <MetricLabel>Distribusi Grade</MetricLabel>
          <div className="bg-muted flex h-2 gap-px overflow-hidden rounded-full">
            {GRADE_ORDER.map((g) =>
              totals.gradeCounts[g] > 0 ? (
                <div
                  key={g}
                  className={`h-full ${GRADE_BAR[g]}`}
                  style={{ width: `${(totals.gradeCounts[g] / gradeTotal) * 100}%` }}
                  title={`Grade ${g}: ${totals.gradeCounts[g]} karyawan`}
                />
              ) : null
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {GRADE_ORDER.map((g) => (
              <div key={g} className="flex items-center gap-1.5">
                <span className={`size-2 shrink-0 rounded-sm ${GRADE_BAR[g]}`} />
                <span className="text-muted-foreground text-xs">
                  Grade {g}{" "}
                  <span className="text-foreground tabular font-medium">
                    {totals.gradeCounts[g]}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Rata-rata per PT ── */}
      {byCompany.length > 0 && (
        <MetricRow
          title="Rata-rata per PT"
          columns={byCompany.length >= 3 ? 3 : 2}
          className="-mt-px"
        >
          {byCompany.map((c) => (
            <MetricBlock
              key={c.companyId}
              label={c.name}
              size="secondary"
              value={c.avgScore === null ? "—" : formatPercent(c.avgScore)}
              delta={c.deltaPct}
              period="vs bulan lalu"
              meta={`${c.scored} dari ${c.employees} karyawan dinilai`}
            />
          ))}
        </MetricRow>
      )}

      {/* ── Peringkat karyawan ── */}
      <div className="mt-10 flex flex-col gap-6">
        <SectionCard
          title="Peringkat Karyawan"
          description={`${period.label} · urut menurut ${SORT_LABELS[sort].toLowerCase()}`}
          padded={false}
          toolbar={
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari nama, jabatan, atau cabang..."
              />
              <Select value={company} onValueChange={setCompany}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua PT</SelectItem>
                  {byCompany.map((c) => (
                    <SelectItem key={c.companyId} value={c.companyId}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua jabatan</SelectItem>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="ml-auto w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SORT_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
          footer={`${filtered.length} dari ${rows.length} karyawan ditampilkan`}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Karyawan</TableHead>
                <TableHead>PT / Cabang</TableHead>
                <TableHead className="text-right">Skor</TableHead>
                <TableHead>vs Bulan Lalu</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Tren {historyLabels.length} Bulan</TableHead>
                <TableHead>KPI Terlemah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      icon={<IconChartHistogram className="size-5" />}
                      title={
                        rows.length === 0
                          ? "Belum ada karyawan berjabatan"
                          : "Tidak ada hasil"
                      }
                      description={
                        rows.length === 0
                          ? "Tetapkan jabatan dan cabang pada karyawan agar KPI-nya bisa dinilai."
                          : "Tidak ada karyawan yang cocok dengan filter ini."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r, i) => (
                  <TableRow key={r.employeeId} className={r.score === null ? "opacity-60" : undefined}>
                    <TableCell className="text-muted-foreground tabular">{i + 1}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-muted-foreground text-xs">{r.roleName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.companyCode} · {r.branchName}
                    </TableCell>
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
                    <TableCell>
                      <Sparkline values={r.history} labels={historyLabels} max={sparkMax} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.weakest ? (
                        <div className="flex flex-col">
                          <span>{r.weakest.name}</span>
                          <span className="text-muted-foreground tabular text-xs">
                            {formatPercent(r.weakest.achievement)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>

        {/* ── Ringkasan per jabatan ── */}
        <SectionCard
          title="Rata-rata per Jabatan"
          description="Diurutkan dari jabatan dengan rata-rata terendah — beserta KPI yang paling menariknya turun."
          padded={false}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jabatan</TableHead>
                <TableHead className="text-right">Dinilai</TableHead>
                <TableHead className="text-right">Rata-rata Skor</TableHead>
                <TableHead>KPI Terlemah di Jabatan Ini</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byRole.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState
                      title="Belum ada data jabatan"
                      description="Skor akan muncul setelah ada karyawan yang dinilai pada periode ini."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                byRole.map((r) => (
                  <TableRow key={r.roleName}>
                    <TableCell className="font-medium">{r.roleName}</TableCell>
                    <TableCell className="tabular text-muted-foreground text-right">
                      {r.scored} / {r.employees}
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {r.avgScore === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatPercent(r.avgScore)
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.weakestKpi ? (
                        <>
                          {r.weakestKpi.name}{" "}
                          <span className="text-muted-foreground tabular text-xs">
                            ({formatPercent(r.weakestKpi.achievement)})
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>

        <p className="text-muted-foreground text-xs">
          Skor berasal dari hasil KPI yang sudah dihitung. Karyawan bertanda “belum dinilai”
          perlu dihitung dulu di{" "}
          <Link href="/dashboard/kpi/log" className="text-foreground underline">
            Penilaian &amp; Persetujuan
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
