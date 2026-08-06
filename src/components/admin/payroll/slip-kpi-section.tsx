"use client";

// Skor KPI karyawan pada bulan slip ini.
//
// KPI TIDAK menghitung uang. Ia hanya menghasilkan skor; yang mengubah skor
// menjadi bonus atau denda adalah rule reward/denda di daftar entri slip
// (lihat docs/tasks/spesifikasi-rule-slip-gaji.md). Bagian ini ada supaya
// angka itu bisa ditelusuri tanpa berpindah halaman: berapa persen skornya,
// dari KPI apa saja, dan berapa kali karyawan (atau atasannya) melaporkan.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconChevronRight } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  INPUT_SOURCE_LABELS,
  MONTH_NAMES,
  UNIT_LABELS,
  formatAmount,
  formatPercent,
  getGrade,
  gradeClassName,
  gradeLabel,
} from "@/lib/kpi-utils";
import type { KpiBreakdown, MonthlyResult } from "@/lib/kpi-utils";

type ApiEnvelope<T> = { data: T | null; message: string | null };

/** Entri KPI seperti dikirim /api/kpi-entries — Decimal & Date sudah jadi string. */
type KpiEntryRow = {
  id: string;
  occurredAt: string;
  /** Periode yang tersimpan pada barisnya — dipakai memverifikasi, bukan dihitung
   *  ulang dari `occurredAt`. Kalau keduanya berbeda, yang menentukan periode
   *  sebuah entri adalah kolom ini (itu yang dipakai perhitungan skor). */
  periodMonth: number;
  periodYear: number;
  weekOfMonth: number;
  quantity: string | number;
  note: string | null;
  source: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdBy: { id: string; name: string } | null;
  roleKpi: {
    id: string;
    definition: { id: string; code: string; name: string; unit: string };
  };
};

type EntriesPayload = {
  entries: KpiEntryRow[];
  period: { status: "OPEN" | "LOCKED"; lockedAt: string | null } | null;
};

const STATUS_BADGE: Record<KpiEntryRow["status"], { label: string; variant: string }> = {
  APPROVED: { label: "Disetujui", variant: "soft" },
  PENDING: { label: "Menunggu persetujuan", variant: "outline" },
  REJECTED: { label: "Ditolak", variant: "outline" },
};

const FORBIDDEN = Symbol("forbidden");

async function getJson<T>(url: string): Promise<T | typeof FORBIDDEN> {
  const res = await fetch(url);
  if (res.status === 403) return FORBIDDEN;
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok) throw new Error(json?.message ?? "Gagal memuat data KPI");
  return (json.data ?? null) as T;
}

export function SlipKpiSection({
  userId,
  month,
  year,
}: {
  userId: string;
  month: number;
  year: number;
}) {
  const params = `employeeId=${userId}&month=${month}&year=${year}`;

  const resultQuery = useQuery({
    queryKey: ["kpi-monthly-result", userId, month, year],
    queryFn: () => getJson<MonthlyResult | null>(`/api/kpi-monthly-results?${params}`),
  });

  const entriesQuery = useQuery({
    queryKey: ["kpi-entries", userId, month, year],
    queryFn: () => getJson<EntriesPayload>(`/api/kpi-entries?${params}`),
  });

  if (resultQuery.isLoading || entriesQuery.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (resultQuery.data === FORBIDDEN || entriesQuery.data === FORBIDDEN) {
    return (
      <p className="text-muted-foreground text-xs">
        Tidak punya akses melihat KPI karyawan ini.
      </p>
    );
  }

  if (resultQuery.isError || entriesQuery.isError) {
    return (
      <p className="text-muted-foreground text-xs">
        Gagal memuat KPI bulan ini. Muat ulang halaman untuk mencoba lagi.
      </p>
    );
  }

  const periodeLabel = `${MONTH_NAMES[month]} ${year}`;

  // Yang datang dari server DIPERIKSA periodenya, bukan dipercaya.
  //
  // Bagian ini duduk di halaman slip satu bulan tertentu, dan angka KPI bulan
  // lain yang menyelinap ke sini tidak akan terlihat salah oleh siapa pun — ia
  // hanya terbaca sebagai "skornya segitu". Jadi hasil yang bulannya tidak sama
  // dengan slip dibuang, dan penyebabnya dikatakan terang-terangan alih-alih
  // ditampilkan diam-diam.
  const hasilMentah = (resultQuery.data ?? null) as MonthlyResult | null;
  const hasilBedaPeriode =
    hasilMentah !== null && (hasilMentah.month !== month || hasilMentah.year !== year);
  const result = hasilBedaPeriode ? null : hasilMentah;

  const entriesMentah = entriesQuery.data?.entries ?? [];
  const entries = entriesMentah.filter(
    (e) => e.periodMonth === month && e.periodYear === year
  );
  const entriBedaPeriode = entriesMentah.length - entries.length;

  const periodLocked = entriesQuery.data?.period?.status === "LOCKED";

  const breakdown: KpiBreakdown | null = result?.breakdownJson ?? null;
  const items = breakdown?.items ?? [];
  const totalScore = result ? Number(result.totalScore) : null;
  const grade = result?.grade ?? (totalScore !== null ? getGrade(totalScore).letter : null);

  // "Pelaporan" = entri KPI yang tercatat bulan ini, apa pun statusnya. Yang
  // ditolak tetap dihitung sebagai pelaporan (memang pernah dilaporkan), tapi
  // hanya yang disetujui yang membentuk skor — jadi keduanya ditampilkan
  // terpisah, bukan dilebur jadi satu angka yang tidak bisa dijelaskan.
  const disetujui = entries.filter((e) => e.status === "APPROVED").length;
  const menunggu = entries.filter((e) => e.status === "PENDING").length;
  const ditolak = entries.filter((e) => e.status === "REJECTED").length;

  return (
    <div className="space-y-5">
      {/* ── Skor ─────────────────────────────────────────────────────────── */}
      {hasilBedaPeriode && (
        <p className="text-warning text-xs text-pretty">
          Server mengirim skor KPI periode lain ({MONTH_NAMES[hasilMentah.month]}{" "}
          {hasilMentah.year}) untuk slip {periodeLabel} — angkanya tidak ditampilkan. Laporkan
          ini ke tim teknis.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Skor KPI {periodeLabel}
          </p>
          <p className="tabular mt-2 text-3xl leading-none font-semibold tracking-tight">
            {totalScore !== null ? formatPercent(totalScore) : "—"}
          </p>
          {grade && (
            <p className={`mt-2 text-xs font-medium ${gradeClassName(grade)}`}>
              Grade {grade} · {gradeLabel(grade)}
            </p>
          )}
        </div>

        <div>
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Pelaporan {periodeLabel}
          </p>
          <p className="tabular mt-2 text-3xl leading-none font-semibold tracking-tight">
            {entries.length}
            <span className="text-muted-foreground ml-1 text-sm font-normal">kali</span>
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            {disetujui} disetujui
            {menunggu > 0 && ` · ${menunggu} menunggu`}
            {ditolak > 0 && ` · ${ditolak} ditolak`}
          </p>
        </div>

        <div>
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Periode penilaian {periodeLabel}
          </p>
          <p className="mt-2 text-lg leading-none font-medium">
            {periodLocked ? "Terkunci" : "Terbuka"}
          </p>
          {/* Tanggal ini adalah KAPAN SKORNYA DIHITUNG, bukan periode yang
              dinilai — skor Juli yang baru dihitung awal Agustus akan tertulis
              "6 Agu". Kata "terakhir dihitung" dan label periode di atas ada
              supaya keduanya tidak lagi bisa tertukar. */}
          <p className="text-muted-foreground mt-2 text-xs">
            {result
              ? `Skornya terakhir dihitung ${new Date(result.calculatedAt).toLocaleDateString(
                  "id-ID",
                  { day: "numeric", month: "short", year: "numeric" }
                )}`
              : "Skor belum pernah dihitung"}
          </p>
        </div>
      </div>

      {entriBedaPeriode > 0 && (
        <p className="text-warning text-xs text-pretty">
          {entriBedaPeriode} entri KPI dari periode lain ikut terkirim dan tidak dihitung di
          sini. Laporkan ini ke tim teknis.
        </p>
      )}

      {/* Toleransi 0,5%: bobot disimpan sebagai desimal, jadi 0,3 + 0,3 + 0,4
          bisa berjumlah 0,9999999999 — peringatan yang menyala karena itu akan
          muncul di hampir setiap jabatan dan berhenti dibaca orang. */}
      {breakdown && Math.abs(breakdown.weightSum - 1) > 0.005 && (
        <p className="text-warning text-xs text-pretty">
          Jumlah bobot KPI jabatan ini {formatPercent(breakdown.weightSum)}, bukan 100% — skor
          totalnya tidak bisa dibandingkan langsung dengan jabatan lain.
        </p>
      )}

      {/* ── Isi KPI bulan ini ────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm text-pretty">
          {result
            ? `Tidak ada KPI aktif untuk jabatan ini pada ${periodeLabel}.`
            : `Skor KPI ${periodeLabel} belum pernah dihitung, jadi rinciannya belum ada. Hitung dari halaman Penilaian KPI.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-xs">
                <th className="py-2 pr-3 text-left font-medium">KPI</th>
                <th className="px-3 py-2 text-right font-medium">Bobot</th>
                <th className="px-3 py-2 text-right font-medium">Realisasi</th>
                <th className="px-3 py-2 text-right font-medium">Pencapaian</th>
                <th className="px-3 py-2 text-right font-medium">Lapor</th>
                <th className="py-2 pl-3 text-right font-medium">Kontribusi</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {items.map((item) => (
                <tr key={item.roleKpiId} className={item.noData ? "opacity-70" : ""}>
                  <td className="min-w-0 py-2.5 pr-3">
                    <p className="text-pretty">{item.kpiName}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
                      {INPUT_SOURCE_LABELS[item.inputSource] ?? item.inputSource}
                      {item.noData && " · belum ada data"}
                    </p>
                  </td>
                  <td className="tabular text-muted-foreground px-3 py-2.5 text-right whitespace-nowrap">
                    {formatPercent(item.weight, 0)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right whitespace-nowrap">
                    {formatAmount(item.actual)}
                    <span className="text-muted-foreground ml-1 text-xs">
                      {UNIT_LABELS[item.unit] ?? ""}
                    </span>
                  </td>
                  <td
                    className={`tabular px-3 py-2.5 text-right whitespace-nowrap ${achievementTone(
                      item.achievement,
                      item.noData
                    )}`}
                  >
                    {formatPercent(item.achievement, 0)}
                  </td>
                  <td className="tabular text-muted-foreground px-3 py-2.5 text-right whitespace-nowrap">
                    {item.entryCount}×
                  </td>
                  <td className="tabular py-2.5 pl-3 text-right whitespace-nowrap">
                    {formatPercent(item.weightedScore, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Laporan KPI ──────────────────────────────────────────────────── */}
      {entries.length > 0 && <KpiEntryLog entries={entries} periodeLabel={periodeLabel} />}
    </div>
  );
}

function achievementTone(achievement: number, noData: boolean) {
  if (noData) return "text-muted-foreground";
  if (achievement >= 0.9) return "text-success";
  if (achievement >= 0.6) return "text-warning";
  return "text-destructive";
}

/** Daftar pelaporan KPI bulan itu — tertutup secara default karena bisa panjang. */
function KpiEntryLog({
  entries,
  periodeLabel,
}: {
  entries: KpiEntryRow[];
  periodeLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground -ml-1 flex items-center gap-1 rounded px-1 text-xs transition-colors">
        <IconChevronRight
          className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
        Laporan KPI {periodeLabel} ({entries.length} pelaporan)
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-border/60 bg-muted/25 mt-2 max-h-96 overflow-auto rounded-md border">
          <table className="w-full min-w-[520px] text-xs">
            <thead className="bg-muted/60 text-muted-foreground sticky top-0">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                <th className="px-3 py-2 text-left font-medium">KPI</th>
                <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                <th className="px-3 py-2 text-left font-medium">Pencatat</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {entries.map((e) => (
                <tr key={e.id} className={e.status === "REJECTED" ? "opacity-60" : ""}>
                  <td className="tabular px-3 py-1.5 whitespace-nowrap">
                    {formatEntryDate(e.occurredAt)}
                  </td>
                  <td className="px-3 py-1.5">
                    <span>{e.roleKpi.definition.name}</span>
                    {e.note && (
                      <span className="text-muted-foreground block text-pretty">{e.note}</span>
                    )}
                  </td>
                  <td className="tabular px-3 py-1.5 text-right whitespace-nowrap">
                    {formatAmount(Number(e.quantity))}
                    <span className="text-muted-foreground ml-1">
                      {UNIT_LABELS[e.roleKpi.definition.unit] ?? ""}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-3 py-1.5 whitespace-nowrap">
                    {e.createdBy?.name ?? "Sistem"}
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge
                      variant={
                        STATUS_BADGE[e.status].variant as React.ComponentProps<
                          typeof Badge
                        >["variant"]
                      }
                      className="text-[10px]"
                    >
                      {STATUS_BADGE[e.status].label}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * `occurredAt` bertipe `@db.Date` (tengah malam UTC), jadi dirender di UTC —
 * tanpa itu, entri tanggal 1 tampil sebagai tanggal 31 bulan sebelumnya di
 * perangkat dengan offset negatif.
 */
function formatEntryDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
