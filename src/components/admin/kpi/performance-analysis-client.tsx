"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  aggregatePerformance,
  NO_BRANCH,
  NO_COMPANY,
  type PerformanceOverview,
} from "@/lib/kpi-analytics";

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
  width = SPARK_W,
  height = SPARK_H,
  description = "Tren",
}: {
  values: (number | null)[];
  labels: string[];
  max: number;
  width?: number;
  height?: number;
  description?: string;
}) {
  const points = values.map((v, i) => ({
    x: values.length <= 1 ? width / 2 : (i / (values.length - 1)) * width,
    y: v === null ? null : height - (Math.max(v, 0) / max) * height,
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
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-primary overflow-visible"
      role="img"
      aria-label={`${description} ${labels.join(", ")}: ${values
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

const ALL = "ALL";

export function PerformanceAnalysisClient({ overview }: { overview: PerformanceOverview }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [company, setCompany] = useState(ALL);
  const [branch, setBranch] = useState(ALL);
  const [role, setRole] = useState(ALL);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("skor-desc");
  const [splitByCompany, setSplitByCompany] = useState(true);

  const { period, historyLabels, rows } = overview;

  /** Ganti periode = data baru dari server, jadi lewat URL bukan state lokal. */
  const setPeriod = (next: { month?: number; year?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(next.month ?? period.month));
    params.set("year", String(next.year ?? period.year));
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  /* ── Pilihan filter ────────────────────────────────────────────────────────
   * Diturunkan dari baris yang ada, bukan dari master data: PT atau cabang yang
   * tidak punya karyawan aktif berjabatan hanya akan menghasilkan halaman
   * kosong kalau dipilih. Karyawan tanpa cabang (jabatan global) tetap dapat
   * entri sendiri lewat sentinel — kalau tidak, mereka tidak bisa dipisahkan.
   */
  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.companyId ?? NO_COMPANY, r.companyName);
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [rows]);

  /**
   * Cabang hanya berarti di dalam satu PT. Selama PT masih "Semua", filternya
   * tidak ditampilkan sama sekali — daftar cabang lintas PT tidak bisa dibaca
   * sebagai pilihan yang bermakna, dan nama cabang bisa sama di dua PT.
   */
  const branchOptions = useMemo(() => {
    if (company === ALL) return [];
    const map = new Map<string, string>();
    for (const r of rows) {
      if ((r.companyId ?? NO_COMPANY) !== company) continue;
      map.set(r.branchId ?? NO_BRANCH, r.branchName);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [rows, company]);

  /**
   * Jabatan yang dipakai karyawan ber-PT saja. Jabatan yang hanya dimiliki
   * karyawan tanpa PT tidak ikut muncul — memilihnya tidak pernah berguna untuk
   * membandingkan tim antar PT, dan hanya membuat daftar jabatan bengkak.
   */
  const rolesFor = useMemo(() => {
    const perCompany = new Map<string, Set<string>>();
    const all = new Set<string>();
    for (const r of rows) {
      if (!r.companyId) continue;
      all.add(r.roleName);
      const set = perCompany.get(r.companyId) ?? new Set<string>();
      set.add(r.roleName);
      perCompany.set(r.companyId, set);
    }
    return (companyId: string) =>
      [...(companyId === ALL ? all : (perCompany.get(companyId) ?? new Set<string>()))].sort(
        (a, b) => a.localeCompare(b, "id")
      );
  }, [rows]);

  const roleOptions = useMemo(() => rolesFor(company), [rolesFor, company]);

  /**
   * Mengganti PT bisa membuat cabang & jabatan terpilih jadi mustahil. Cabang
   * selalu direset (pilihannya terikat PT), jabatan hanya kalau memang tidak
   * ada di PT baru — kalau namanya sama, mempertahankannya justru yang dimau.
   */
  const changeCompany = (value: string) => {
    setCompany(value);
    setBranch(ALL);
    if (role !== ALL && !rolesFor(value).includes(role)) setRole(ALL);
  };

  const filtersActive = company !== ALL || branch !== ALL || role !== ALL;

  const resetFilters = () => {
    setCompany(ALL);
    setBranch(ALL);
    setRole(ALL);
  };

  /**
   * Lingkup halaman. Semua angka di bawah — hero, distribusi grade, per PT, per
   * jabatan — dihitung dari sini, jadi memilih PT + jabatan langsung memberi
   * skor tim tersebut, bukan rata-rata seluruh perusahaan.
   *
   * Pencarian sengaja tidak ikut: itu alat mencari orang di dalam tabel, bukan
   * penyempit lingkup — kalau ikut, mengetik satu nama akan membuat "rata-rata"
   * berubah menjadi skor satu orang.
   */
  const scoped = useMemo(
    () =>
      rows.filter(
        (r) =>
          (company === ALL || (r.companyId ?? NO_COMPANY) === company) &&
          (branch === ALL || (r.branchId ?? NO_BRANCH) === branch) &&
          (role === ALL || r.roleName === role)
      ),
    [rows, company, branch, role]
  );

  const { totals, byCompany, byRole, byRoleCompany } = useMemo(
    () => aggregatePerformance(scoped),
    [scoped]
  );

  const scopeLabel = useMemo(() => {
    const parts = [
      companyOptions.find((c) => c.value === company)?.label,
      branchOptions.find((b) => b.value === branch)?.label,
      role === ALL ? undefined : role,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "Seluruh Karyawan";
  }, [company, branch, role, companyOptions, branchOptions]);

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
    const list = scoped.filter(
      (r) =>
        q === "" ||
        [r.name, r.roleName, r.branchName, r.companyName].some((v) =>
          v.toLowerCase().includes(q)
        )
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
  }, [scoped, search, sort]);

  const goodCount = totals.gradeCounts.A + totals.gradeCounts.B;
  const gradeTotal = GRADE_ORDER.reduce((sum, g) => sum + totals.gradeCounts[g], 0);

  /** Memisah per PT hanya masuk akal kalau lingkupnya memang lintas PT. */
  const canSplit = byCompany.length > 1;
  const roleRows = canSplit && splitByCompany ? byRoleCompany : byRole;

  return (
    <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
      {/* ── Filter: menentukan seluruh angka di halaman ── */}
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
            options={Array.from({ length: 5 }, (_, i) => period.year - 2 + i).map(
              (y) => ({ value: String(y), label: String(y) })
            )}
            className="w-24"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-muted-foreground text-xs">PT</Label>
          <Combobox
            value={company}
            onValueChange={changeCompany}
            options={[{ value: ALL, label: "Semua PT" }, ...companyOptions]}
            searchPlaceholder="Cari PT..."
            className="w-44"
          />
        </div>
        {/* Cabang baru muncul setelah PT dipilih — lihat `branchOptions`. */}
        {company !== ALL && (
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground text-xs">Cabang</Label>
            <Combobox
              value={branch}
              onValueChange={setBranch}
              options={[{ value: ALL, label: "Semua cabang" }, ...branchOptions]}
              searchPlaceholder="Cari cabang..."
              className="w-44"
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label className="text-muted-foreground text-xs">Jabatan</Label>
          <Combobox
            value={role}
            onValueChange={setRole}
            options={[
              { value: ALL, label: "Semua jabatan" },
              ...roleOptions.map((r) => ({ value: r, label: r })),
            ]}
            searchPlaceholder="Cari jabatan..."
            className="w-44"
          />
        </div>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset filter
          </Button>
        )}
      </div>

      {/* ── Angka utama halaman, mengikuti filter ── */}
      <section className="border-border flex flex-wrap items-end justify-between gap-6 border-y py-8">
        <div className="min-w-0">
          <MetricLabel>Rata-rata Skor · {scopeLabel}</MetricLabel>
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
              ? "belum ada karyawan yang dinilai pada lingkup ini"
              : `dihitung dari ${totals.scored} karyawan yang sudah dinilai`}
          </p>
        </div>

        {/* Tren rata-rata lingkup ini, bukan per orang. */}
        <div className="flex flex-col gap-2">
          <MetricLabel>Tren {historyLabels.length} Bulan</MetricLabel>
          <Sparkline
            values={totals.history}
            labels={historyLabels}
            max={sparkMax}
            width={220}
            height={48}
            description={`Tren rata-rata ${scopeLabel}:`}
          />
          <div className="text-muted-foreground flex justify-between text-[0.7rem]">
            <span>{historyLabels[0]}</span>
            <span>{historyLabels[historyLabels.length - 1]}</span>
          </div>
        </div>
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

      {/* ── Rata-rata per PT, dalam lingkup filter yang aktif ── */}
      {byCompany.length > 1 && (
        <MetricRow
          title={role === ALL ? "Rata-rata per PT" : `Rata-rata per PT · ${role}`}
          columns={byCompany.length >= 3 ? 3 : 2}
          className="-mt-px"
        >
          {byCompany.map((c) => (
            <MetricBlock
              key={c.key}
              label={c.label}
              size="secondary"
              value={c.avgScore === null ? "—" : formatPercent(c.avgScore)}
              delta={c.deltaPct}
              period="vs bulan lalu"
              meta={`${c.scored} dari ${c.employees} karyawan dinilai`}
            />
          ))}
        </MetricRow>
      )}

      <div className="mt-10 flex flex-col gap-6">
        {/* ── Skor tim per jabatan (opsional dipisah per PT) ── */}
        <SectionCard
          title="Rata-rata per Jabatan"
          description={
            canSplit && splitByCompany
              ? "Skor tim tiap jabatan di masing-masing PT — diurutkan dari yang terendah."
              : "Diurutkan dari jabatan dengan rata-rata terendah — beserta KPI yang paling menariknya turun."
          }
          padded={false}
          toolbar={
            canSplit ? (
              <Combobox
                value={splitByCompany ? "split" : "merged"}
                onValueChange={(v) => setSplitByCompany(v === "split")}
                options={[
                  { value: "split", label: "Pisah per PT" },
                  { value: "merged", label: "Gabung semua PT" },
                ]}
                className="ml-auto w-52"
              />
            ) : undefined
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jabatan</TableHead>
                {canSplit && splitByCompany && <TableHead>PT</TableHead>}
                <TableHead className="text-right">Dinilai</TableHead>
                <TableHead className="text-right">Rata-rata Skor</TableHead>
                <TableHead>vs Bulan Lalu</TableHead>
                <TableHead>KPI Terlemah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={canSplit && splitByCompany ? 6 : 5} className="p-0">
                    <EmptyState
                      title="Belum ada data jabatan"
                      description="Skor akan muncul setelah ada karyawan yang dinilai pada lingkup ini."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                roleRows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    {canSplit && splitByCompany && (
                      <TableCell className="text-muted-foreground text-sm">
                        {r.subLabel}
                      </TableCell>
                    )}
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
                    <TableCell>
                      <DeltaPill value={r.deltaPct} />
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

        {/* ── Peringkat karyawan ── */}
        <SectionCard
          title="Peringkat Karyawan"
          description={`${period.label} · ${scopeLabel} · urut menurut ${SORT_LABELS[sort].toLowerCase()}`}
          padded={false}
          toolbar={
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari nama, jabatan, atau cabang..."
              />
              <Combobox
                value={sort}
                onValueChange={(v) => setSort(v as SortKey)}
                options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
                  value: k,
                  label: SORT_LABELS[k],
                }))}
                searchPlaceholder="Cari urutan..."
                className="ml-auto w-48"
              />
            </>
          }
          footer={
            filtersActive
              ? `${filtered.length} dari ${scoped.length} karyawan dalam lingkup ini (${rows.length} total)`
              : `${filtered.length} dari ${rows.length} karyawan ditampilkan`
          }
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
                      {r.kpis[0] ? (
                        <div className="flex flex-col">
                          <span>{r.kpis[0].name}</span>
                          <span className="text-muted-foreground tabular text-xs">
                            {formatPercent(r.kpis[0].achievement)}
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
