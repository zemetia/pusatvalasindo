import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCount,
  formatDate,
  formatIdr,
  formatIdrSigned,
  formatPercent,
  formatQty,
  share,
} from "@/lib/format";
import type {
  CompanyFinanceReport,
  FinanceSeriesPoint,
  GroupFinanceReport,
} from "@/backend/services/finance-report.service";
import { cn } from "@/lib/utils";

/**
 * Tabel-tabel Laporan Finance.
 *
 * Semuanya Server Component murni: angka sudah jadi string `id-ID` sebelum
 * dikirim ke browser. Gaya mengikuti `DATA_PRESENTATION.md` §8 — pemisah baris
 * garis rambut, kolom angka rata kanan + `.tabular`, baris total ditegaskan
 * lewat `font-semibold` dan `border-t`, bukan lewat blok warna.
 */

const NUMERIC = "tabular text-right";
const HEAD_NUMERIC = "text-right tracking-wide uppercase";
const HEAD = "tracking-wide uppercase";

/**
 * Angka selisih/perubahan, dengan arah "baik" yang eksplisit — sama seperti
 * `DeltaPill`, warna ditentukan oleh makna, bukan oleh tanda angka
 * (DATA_PRESENTATION §6):
 *
 * - `up`   — naik itu bagus (posisi aset). Nol netral.
 * - `down` — turun itu bagus (biaya, keterlambatan). Nol netral.
 * - `zero` — hanya nol yang bagus (selisih cross-check): selisih ke arah mana
 *   pun sama-sama perlu ditelusuri, jadi tidak pernah hijau selain di nol.
 */
function Diff({
  value,
  goodWhen = "up",
  className,
}: {
  value: number | null;
  goodWhen?: "up" | "down" | "zero";
  className?: string;
}) {
  if (value == null) return <span className="text-muted-foreground">—</span>;

  // Di bawah setengah rupiah = pembulatan, bukan perubahan nyata.
  const flat = Math.abs(value) <= 0.5;

  const wentUp = value > 0;
  let tone: string;
  if (goodWhen === "zero") tone = flat ? "text-success" : "text-destructive";
  else if (flat) tone = "text-muted-foreground";
  else tone = wentUp === (goodWhen === "up") ? "text-success" : "text-destructive";

  return <span className={cn("tabular", tone, className)}>{formatIdrSigned(value)}</span>;
}

/* ── Komposisi aset ───────────────────────────────────────────────────────── */

/**
 * Bar komposisi stock/kas/bank. Satu hue dengan tiga tingkat opasitas — bukan
 * tiga warna semantik, karena komposisi bukan status (DATA_PRESENTATION §9).
 */
export function CompositionBar({
  stock,
  kas,
  bank,
}: {
  stock: number | null;
  kas: number | null;
  bank: number | null;
}) {
  const total = (stock ?? 0) + (kas ?? 0) + (bank ?? 0);
  if (total <= 0) return null;

  const segments = [
    { label: "Stock", value: stock ?? 0, className: "bg-primary" },
    { label: "Kas", value: kas ?? 0, className: "bg-primary/60" },
    { label: "Bank", value: bank ?? 0, className: "bg-primary/30" },
  ];

  return (
    <div>
      <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={segment.className}
            style={{ width: `${(segment.value / total) * 100}%` }}
            title={`${segment.label} ${formatPercent(share(segment.value, total))}`}
          />
        ))}
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {segments.map((segment) => (
          <span key={segment.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", segment.className)} aria-hidden />
            {segment.label}
            <span className="tabular text-foreground">
              {formatPercent(share(segment.value, total))}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Ringkasan per PT ─────────────────────────────────────────────────────── */

export function CompanyBreakdownTable({
  companies,
  group,
}: {
  companies: CompanyFinanceReport[];
  group: GroupFinanceReport;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>PT</TableHead>
          <TableHead className={HEAD_NUMERIC}>Stock</TableHead>
          <TableHead className={HEAD_NUMERIC}>Kas</TableHead>
          <TableHead className={HEAD_NUMERIC}>Bank</TableHead>
          <TableHead className={HEAD_NUMERIC}>Total Akhir</TableHead>
          <TableHead className={HEAD_NUMERIC}>Posisi Awal</TableHead>
          <TableHead className={HEAD_NUMERIC}>Perubahan</TableHead>
          <TableHead className={HEAD_NUMERIC}>Porsi Grup</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company) => (
          <TableRow key={company.id}>
            <TableCell className="font-medium">
              {company.name}
              {/* "per —" tidak berarti apa-apa; tanggal hanya ikut kalau ada. */}
              {company.closing.date && (
                <span className="text-muted-foreground ml-2 text-xs">
                  per {formatDate(company.closing.date)}
                </span>
              )}
            </TableCell>
            <TableCell className={NUMERIC}>{formatIdr(company.closing.stock)}</TableCell>
            <TableCell className={NUMERIC}>{formatIdr(company.closing.kas)}</TableCell>
            <TableCell className={NUMERIC}>{formatIdr(company.closing.bank)}</TableCell>
            <TableCell className={cn(NUMERIC, "font-medium")}>
              {formatIdr(company.closing.total)}
            </TableCell>
            <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
              {formatIdr(company.opening.total)}
            </TableCell>
            <TableCell className={NUMERIC}>
              <Diff value={company.netChange} />
            </TableCell>
            <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
              {formatPercent(share(company.closing.total, group.closing.total))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow className="hover:bg-transparent">
          <TableCell className="font-semibold">Konsolidasi</TableCell>
          <TableCell className={cn(NUMERIC, "font-semibold")}>
            {formatIdr(group.closing.stock)}
          </TableCell>
          <TableCell className={cn(NUMERIC, "font-semibold")}>
            {formatIdr(group.closing.kas)}
          </TableCell>
          <TableCell className={cn(NUMERIC, "font-semibold")}>
            {formatIdr(group.closing.bank)}
          </TableCell>
          <TableCell className={cn(NUMERIC, "font-semibold")}>
            {formatIdr(group.closing.total)}
          </TableCell>
          <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
            {formatIdr(group.opening.total)}
          </TableCell>
          <TableCell className={NUMERIC}>
            <Diff value={group.netChange} className="font-semibold" />
          </TableCell>
          {/* Dihitung, bukan ditulis "100,0%": tanpa data sama sekali baris ini
              harus ikut em dash seperti kolom lainnya. */}
          <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
            {formatPercent(share(group.closing.total, group.closing.total))}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

/* ── Rincian harian ───────────────────────────────────────────────────────── */

const MAX_DAILY_ROWS = 62;

export function DailyDetailTable({ series }: { series: FinanceSeriesPoint[] }) {
  // Terbaru di atas: yang paling sering dicari owner adalah hari-hari terakhir.
  const rows = [...series].reverse().slice(0, MAX_DAILY_ROWS);
  const indexByDate = new Map(series.map((point, index) => [point.date, index]));

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={HEAD}>Tanggal</TableHead>
            <TableHead className={HEAD_NUMERIC}>Stock</TableHead>
            <TableHead className={HEAD_NUMERIC}>Kas</TableHead>
            <TableHead className={HEAD_NUMERIC}>Bank</TableHead>
            <TableHead className={HEAD_NUMERIC}>Total</TableHead>
            <TableHead className={HEAD_NUMERIC}>Perubahan Harian</TableHead>
            <TableHead className={HEAD}>Sumber</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((point) => {
            const index = indexByDate.get(point.date) ?? 0;
            const previous = index > 0 ? series[index - 1] : undefined;
            const change =
              previous?.total == null || point.total == null ? null : point.total - previous.total;

            return (
              <TableRow key={point.date}>
                <TableCell className="font-medium">{formatDate(point.date)}</TableCell>
                <TableCell className={NUMERIC}>{formatIdr(point.stock)}</TableCell>
                <TableCell className={NUMERIC}>{formatIdr(point.kas)}</TableCell>
                <TableCell className={NUMERIC}>{formatIdr(point.bank)}</TableCell>
                <TableCell className={cn(NUMERIC, "font-medium")}>
                  {formatIdr(point.total)}
                </TableCell>
                <TableCell className={NUMERIC}>
                  <Diff value={change} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {/* "Saldo dibawa maju" hanya benar kalau memang ada saldo yang
                      dibawa. Sebelum konfirmasi pertama, tidak ada apa pun. */}
                  {point.confirmed
                    ? "Konfirmasi hari ini"
                    : point.total == null
                      ? "Belum ada data"
                      : "Saldo dibawa maju"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {series.length > MAX_DAILY_ROWS && (
        <p className="text-muted-foreground px-3 py-3 text-xs">
          Menampilkan {MAX_DAILY_ROWS} hari terakhir dari {formatCount(series.length)} hari dalam
          periode. Persempit periode untuk melihat sisanya.
        </p>
      )}
    </>
  );
}

/* ── Cross-check sistem vs kepala cabang ──────────────────────────────────── */

export function CrossCheckTable({ companies }: { companies: CompanyFinanceReport[] }) {
  const rows = companies.flatMap((company) =>
    (["kas", "bank"] as const).map((kind) => ({
      company: company.name,
      kind: kind === "kas" ? "Kas" : "Bank",
      summary: company.crossCheck[kind],
    })),
  );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>PT</TableHead>
          <TableHead className={HEAD}>Domain</TableHead>
          <TableHead className={HEAD}>Per Tanggal</TableHead>
          <TableHead className={HEAD_NUMERIC}>Total Sistem</TableHead>
          <TableHead className={HEAD_NUMERIC}>Kepala Cabang</TableHead>
          <TableHead className={HEAD_NUMERIC}>Selisih</TableHead>
          <TableHead className={HEAD_NUMERIC}>Hari Beda</TableHead>
          <TableHead className={HEAD_NUMERIC}>Selisih Terbesar</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.company}-${row.kind}`}>
            <TableCell className="font-medium">{row.company}</TableCell>
            <TableCell>{row.kind}</TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDate(row.summary.date)}
            </TableCell>
            <TableCell className={NUMERIC}>{formatIdr(row.summary.system)}</TableCell>
            <TableCell className={NUMERIC}>{formatIdr(row.summary.confirmed)}</TableCell>
            <TableCell className={NUMERIC}>
              <Diff value={row.summary.diff} goodWhen="zero" />
            </TableCell>
            <TableCell className={NUMERIC}>
              <span
                className={cn(
                  "tabular",
                  row.summary.mismatchDays > 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {formatCount(row.summary.mismatchDays)}
              </span>
              <span className="text-muted-foreground text-xs">
                {" "}
                / {formatCount(row.summary.comparedDays)}
              </span>
            </TableCell>
            <TableCell className={cn(NUMERIC, "text-muted-foreground text-xs")}>
              {row.summary.worstDiff == null
                ? "—"
                : `${formatIdrSigned(row.summary.worstDiff)} · ${formatDate(row.summary.worstDate)}`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ── Posisi stock per item ────────────────────────────────────────────────── */

export function StockPositionTable({ companies }: { companies: CompanyFinanceReport[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>PT</TableHead>
          <TableHead className={HEAD}>Item</TableHead>
          <TableHead className={HEAD}>Jenis</TableHead>
          <TableHead className={HEAD_NUMERIC}>Kuantitas Akhir</TableHead>
          <TableHead className={HEAD}>Opname Terakhir</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.flatMap((company) =>
          company.stockItems.map((item, index) => (
            <TableRow key={`${company.id}-${item.id}`}>
              <TableCell className="text-muted-foreground text-xs">
                {index === 0 ? company.name : ""}
              </TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {item.type === "LOGAM_MULIA" ? "Logam mulia" : "Mata uang"}
              </TableCell>
              <TableCell className={cn(NUMERIC, item.qty == null && "text-muted-foreground")}>
                {formatQty(item.qty)}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDate(item.date)}
              </TableCell>
            </TableRow>
          )),
        )}
      </TableBody>
    </Table>
  );
}

/* ── Kualitas data & koreksi ──────────────────────────────────────────────── */

export function QualityTable({ companies }: { companies: CompanyFinanceReport[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>PT</TableHead>
          <TableHead className={HEAD_NUMERIC}>Entri Diverifikasi</TableHead>
          <TableHead className={HEAD_NUMERIC}>Cocok</TableHead>
          <TableHead className={HEAD_NUMERIC}>Beda</TableHead>
          <TableHead className={HEAD_NUMERIC}>Belum Review</TableHead>
          <TableHead className={HEAD_NUMERIC}>Koreksi Menunggu</TableHead>
          <TableHead className={HEAD_NUMERIC}>Koreksi Disetujui</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company) => {
          const total =
            company.verification.stock.total +
            company.verification.kas.total +
            company.verification.bank.total;
          const benar =
            company.verification.stock.benar +
            company.verification.kas.benar +
            company.verification.bank.benar;
          const beda =
            company.verification.stock.beda +
            company.verification.kas.beda +
            company.verification.bank.beda;
          const belum =
            company.verification.stock.belumReview +
            company.verification.kas.belumReview +
            company.verification.bank.belumReview;

          return (
            <TableRow key={company.id}>
              <TableCell className="font-medium">{company.name}</TableCell>
              <TableCell className={NUMERIC}>{formatCount(total)}</TableCell>
              <TableCell className={cn(NUMERIC, "text-success")}>{formatCount(benar)}</TableCell>
              <TableCell
                className={cn(NUMERIC, beda > 0 ? "text-destructive" : "text-muted-foreground")}
              >
                {formatCount(beda)}
              </TableCell>
              <TableCell
                className={cn(NUMERIC, belum > 0 ? "text-warning" : "text-muted-foreground")}
              >
                {formatCount(belum)}
              </TableCell>
              <TableCell
                className={cn(
                  NUMERIC,
                  company.corrections.pending > 0 ? "text-warning" : "text-muted-foreground",
                )}
              >
                {formatCount(company.corrections.pending)}
              </TableCell>
              <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
                {formatCount(company.corrections.approved)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ── Dana tertahan ────────────────────────────────────────────────────────── */

/**
 * Dana Tertahan per PT: posisi belum lunas di akhir periode, berapa yang cair,
 * dan seberapa besar piutang itu dibanding aset yang sudah dikonfirmasi.
 *
 * Kolom terakhir itulah alasan tabel ini ada. "Belum lunas Rp 40 juta" tidak
 * berarti apa-apa sampai dibandingkan dengan posisi asetnya — angka yang sama
 * bisa berarti kebocoran serius di satu PT dan pembulatan di PT lain.
 */
export function HeldFundTable({
  companies,
  group,
}: {
  companies: CompanyFinanceReport[];
  group: GroupFinanceReport;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>PT</TableHead>
          <TableHead className={HEAD_NUMERIC}>Belum Lunas</TableHead>
          <TableHead className={HEAD_NUMERIC}>Catatan</TableHead>
          <TableHead className={HEAD_NUMERIC}>Cair Periode Ini</TableHead>
          <TableHead className={HEAD_NUMERIC}>Tercatat Periode Ini</TableHead>
          <TableHead className={HEAD_NUMERIC}>vs Total Aset</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company) => {
          const held = company.heldFunds;
          return (
            <TableRow key={company.id}>
              <TableCell className="font-medium">{company.name}</TableCell>
              <TableCell
                className={cn(
                  NUMERIC,
                  held.outstanding > 0 ? "text-warning font-medium" : "text-muted-foreground",
                )}
              >
                {formatIdr(held.outstanding)}
              </TableCell>
              <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
                {formatCount(held.outstandingCount)}
              </TableCell>
              <TableCell className={cn(NUMERIC, held.settled > 0 && "text-success")}>
                {formatIdr(held.settled)}
              </TableCell>
              <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
                {formatIdr(held.added)}
              </TableCell>
              {/* Porsi terhadap posisi aset PT-nya sendiri, bukan terhadap grup:
                  yang ingin diketahui adalah seberapa berat piutang itu untuk PT
                  yang menanggungnya. */}
              <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
                {formatPercent(share(held.outstanding, company.closing.total))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow className="hover:bg-transparent">
          <TableCell className="font-semibold">Konsolidasi</TableCell>
          <TableCell className={cn(NUMERIC, "font-semibold")}>
            {formatIdr(group.heldFunds.outstanding)}
          </TableCell>
          <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
            {formatCount(group.heldFunds.outstandingCount)}
          </TableCell>
          <TableCell className={cn(NUMERIC, "font-semibold")}>
            {formatIdr(group.heldFunds.settled)}
          </TableCell>
          <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
            {formatIdr(group.heldFunds.added)}
          </TableCell>
          <TableCell className={cn(NUMERIC, "text-muted-foreground")}>
            {formatPercent(share(group.heldFunds.outstanding, group.closing.total))}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
