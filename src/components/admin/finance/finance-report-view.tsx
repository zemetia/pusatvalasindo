import type { ReactNode } from "react";
import {
  IconAlertTriangle,
  IconArrowsDiff,
  IconCalendarMonth,
  IconChartAreaLine,
  IconCoins,
  IconReportMoney,
  IconShieldCheck,
  IconTable,
} from "@tabler/icons-react";

import type { FinanceReport } from "@/backend/services/finance-report.service";
import {
  formatCompactIdr,
  formatCount,
  formatDate,
  formatIdr,
  formatIdrSigned,
  formatPercent,
  pctChange,
  share,
} from "@/lib/format";
import { MetricBlock, MetricRow, SectionCard } from "@/components/admin/page-shell";
import { FinanceTrendChart } from "@/components/admin/finance/finance-trend-chart";
import { FinanceCalendar } from "@/components/admin/finance/finance-calendar";
import {
  CompanyBreakdownTable,
  CompositionBar,
  CrossCheckTable,
  DailyDetailTable,
  QualityTable,
  StockPositionTable,
} from "@/components/admin/finance/finance-report-tables";

/**
 * Badan Laporan Finance — seluruh section setelah header & pemilih periode.
 *
 * Dipisah dari `page.tsx` supaya halaman hanya mengurus akses, parameter URL,
 * dan pengambilan data, sementara susunan visualnya bisa dibaca (dan dirender
 * ulang) sebagai satu kesatuan. Server Component murni: tidak ada state, angka
 * sudah diformat sebelum sampai ke browser.
 *
 * Paradigma penyajian: `docs/blueprint/DATA_PRESENTATION.md` — angka tidak
 * pernah dibungkus kotak, hierarki dibentuk ukuran & jarak, dan kartu hanya
 * dipakai untuk wilayah dataset (tabel, kalender).
 */
export function FinanceReportView({
  report,
  today,
  calendarMonth,
  calendarPrevHref,
  calendarNextHref,
  dayHref,
}: {
  report: FinanceReport;
  today: string;
  calendarMonth: string;
  calendarPrevHref: string | null;
  calendarNextHref: string | null;
  dayHref: (date: string) => string;
}) {
  const { group, range } = report;

  const changePct = pctChange(group.opening.total, group.closing.total);
  const netChangeTone =
    group.netChange == null || Math.abs(group.netChange) <= 0.5
      ? "muted"
      : group.netChange > 0
        ? "success"
        : "destructive";

  const periodLabel =
    range.from === range.to
      ? formatDate(range.from)
      : `${formatDate(range.from)} – ${formatDate(range.to)}`;

  /**
   * `Rp` hanya ikut tampil kalau angkanya memang ada. Tanpa ini, PT yang belum
   * pernah dikonfirmasi merender "Rp —" — simbol mata uang untuk nilai yang
   * tidak ada, padahal DATA_PRESENTATION §7 mengharuskan em dash berdiri sendiri.
   */
  const rp = (value: number | null | undefined) => (value == null ? undefined : "Rp");

  return (
    <>
      {/* ── Sorotan utama ────────────────────────────────────────────────── */}
      <section className="border-border grid grid-cols-1 gap-8 border-y py-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))] lg:gap-0 lg:[&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:pl-8 lg:[&>*:not(:last-child)]:pr-8">
        <MetricBlock
          size="hero"
          label="Total Aset Konsolidasi"
          prefix={rp(group.closing.total)}
          value={formatIdr(group.closing.total)}
          delta={changePct}
          period="vs posisi awal periode"
          meta={
            // Tanpa satu pun konfirmasi, "Per —" hanya menyisakan teka-teki —
            // lebih jujur menyebut langsung bahwa datanya memang belum ada.
            group.closing.date ? (
              <>
                Per {formatDate(group.closing.date)} · {report.companies.length} PT · angka hasil
                cross-check kepala cabang
              </>
            ) : (
              <>
                Belum ada konfirmasi kepala cabang pada periode ini · {report.companies.length} PT
              </>
            )
          }
        />
        <MetricBlock
          size="secondary"
          label="Perubahan Bersih"
          prefix={rp(group.netChange)}
          tone={netChangeTone}
          value={formatIdrSigned(group.netChange)}
          meta={
            <>
              Periode sebelumnya{" "}
              <span className="tabular text-foreground">
                {group.prevNetChange == null ? "—" : `Rp ${formatIdrSigned(group.prevNetChange)}`}
              </span>
            </>
          }
        />
        <MetricBlock
          size="secondary"
          label="Rata-rata Harian"
          prefix={rp(group.avgTotal)}
          value={formatIdr(group.avgTotal)}
          meta={
            group.peak && group.trough ? (
              <>
                Tertinggi{" "}
                <span className="tabular text-foreground">
                  Rp {formatCompactIdr(group.peak.value)}
                </span>{" "}
                · Terendah{" "}
                <span className="tabular text-foreground">
                  Rp {formatCompactIdr(group.trough.value)}
                </span>
              </>
            ) : (
              "Belum ada hari terkonfirmasi"
            )
          }
        />
        <MetricBlock
          size="secondary"
          label="Hari Terkonfirmasi"
          value={formatCount(group.confirmedDays)}
          suffix={`/ ${range.days}`}
          tone={group.confirmedDays === 0 ? "muted" : "default"}
          meta="Hari yang punya konfirmasi kepala cabang di periode ini"
        />
      </section>

      <p className="text-muted-foreground -mt-6 max-w-3xl text-xs leading-relaxed">
        Angka di halaman ini adalah <strong className="font-medium">posisi aset</strong> (stock +
        kas + bank), bukan laba rugi. &ldquo;Perubahan bersih&rdquo; adalah selisih posisi akhir dan
        posisi awal periode — indikator hasil usaha yang belum dikurangi biaya operasional dan belum
        memisahkan setoran maupun penarikan modal. Hari tanpa konfirmasi memakai saldo terakhir yang
        masih berlaku.
      </p>

      {/* ── Komposisi ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          icon={<IconCoins className="size-4" />}
          title="Komposisi Aset"
          description={`Rincian posisi akhir periode — ${periodLabel}.`}
        />
        <MetricRow columns={3} className="mt-6">
          <MetricBlock
            size="secondary"
            label="Stock Valas & Logam"
            prefix={rp(group.closing.stock)}
            value={formatIdr(group.closing.stock)}
            delta={pctChange(group.opening.stock, group.closing.stock)}
            period="vs awal periode"
            meta={`${formatPercent(share(group.closing.stock, group.closing.total))} dari total aset`}
          />
          <MetricBlock
            size="secondary"
            label="Kas Tunai"
            prefix={rp(group.closing.kas)}
            value={formatIdr(group.closing.kas)}
            delta={pctChange(group.opening.kas, group.closing.kas)}
            period="vs awal periode"
            meta={`${formatPercent(share(group.closing.kas, group.closing.total))} dari total aset`}
          />
          <MetricBlock
            size="secondary"
            label="Saldo Bank"
            prefix={rp(group.closing.bank)}
            value={formatIdr(group.closing.bank)}
            delta={pctChange(group.opening.bank, group.closing.bank)}
            period="vs awal periode"
            meta={`${formatPercent(share(group.closing.bank, group.closing.total))} dari total aset`}
          />
        </MetricRow>
        <div className="mt-8">
          <CompositionBar
            stock={group.closing.stock}
            kas={group.closing.kas}
            bank={group.closing.bank}
          />
        </div>
      </section>

      {/* ── Tren ─────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          icon={<IconChartAreaLine className="size-4" />}
          title="Tren Posisi Aset"
          description={`Saldo akhir harian sepanjang ${periodLabel}. Garis putus-putus = posisi awal periode.`}
        />
        <div className="mt-6">
          <FinanceTrendChart
            points={group.series.map((point) => ({
              date: point.date,
              value: point.total,
              confirmed: point.confirmed,
            }))}
            baseline={group.opening.total}
          />
        </div>
      </section>

      {/* ── Per PT ───────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          icon={<IconReportMoney className="size-4" />}
          title="Posisi per PT"
          description="Posisi akhir tiap PT beserta perubahannya sepanjang periode."
        />
        <MetricRow
          columns={report.companies.length >= 3 ? 3 : 2}
          className="mt-6"
          divided={report.companies.length > 1}
        >
          {report.companies.map((company) => (
            <MetricBlock
              key={company.id}
              size="secondary"
              label={company.name}
              prefix={rp(company.closing.total)}
              value={formatIdr(company.closing.total)}
              delta={pctChange(company.opening.total, company.closing.total)}
              period="vs awal periode"
              meta={
                <>
                  Perubahan{" "}
                  <span className="tabular text-foreground">
                    {company.netChange == null ? "—" : `Rp ${formatIdrSigned(company.netChange)}`}
                  </span>{" "}
                  · {formatCount(company.confirmedDays)} hari terkonfirmasi
                </>
              }
            />
          ))}
        </MetricRow>
        <SectionCard className="mt-8" padded={false}>
          <CompanyBreakdownTable companies={report.companies} group={group} />
        </SectionCard>
      </section>

      {/* ── Kalender ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          icon={<IconCalendarMonth className="size-4" />}
          title="Kalender Keuangan"
          description="Posisi aset konsolidasi per hari. Klik satu tanggal untuk memuat laporan hari itu."
        />
        <SectionCard className="mt-6">
          <FinanceCalendar
            month={calendarMonth}
            series={group.fullSeries}
            range={range}
            today={today}
            prevHref={calendarPrevHref}
            nextHref={calendarNextHref}
            dayHref={dayHref}
          />
        </SectionCard>
      </section>

      {/* ── Rincian harian ───────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          icon={<IconTable className="size-4" />}
          title="Rincian Harian"
          description="Saldo akhir tiap hari beserta perubahan hariannya."
        />
        <SectionCard className="mt-6" padded={false}>
          <DailyDetailTable series={group.series} />
        </SectionCard>
      </section>

      {/* ── Cross-check ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          icon={<IconArrowsDiff className="size-4" />}
          title="Cross-Check Kas & Bank"
          description="Total menurut sistem (input harian) dibanding hasil hitung ulang kepala cabang. Selisih apa pun selain nol perlu ditelusuri."
        />
        <SectionCard className="mt-6" padded={false}>
          <CrossCheckTable companies={report.companies} />
        </SectionCard>
        <p className="text-muted-foreground mt-3 text-xs">
          Stock tidak muncul di sini karena dicocokkan per kuantitas item, bukan per rupiah — lihat
          tabel Posisi Stock di bawah.
        </p>
      </section>

      {/* ── Stock per item ───────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          icon={<IconShieldCheck className="size-4" />}
          title="Posisi Stock per Item"
          description="Hasil opname terakhir dalam periode, dijumlahkan lintas pocket."
        />
        <SectionCard className="mt-6" padded={false}>
          <StockPositionTable companies={report.companies} />
        </SectionCard>
      </section>

      {/* ── Kualitas data ────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          icon={<IconAlertTriangle className="size-4" />}
          title="Kualitas Data & Koreksi"
          description="Seberapa bisa dipercaya angka di atas: hasil verifikasi H+1 dan antrean pengajuan koreksi pada periode ini."
        />
        <MetricRow columns={3} className="mt-6">
          <MetricBlock
            size="secondary"
            label="Entri Cocok"
            value={formatPercent(share(group.verification.benar, group.verification.total))}
            tone="success"
            meta={`${formatCount(group.verification.benar)} dari ${formatCount(group.verification.total)} entri harian terverifikasi`}
          />
          <MetricBlock
            size="secondary"
            label="Entri Beda"
            value={formatCount(group.verification.beda)}
            tone={group.verification.beda > 0 ? "destructive" : "muted"}
            meta={`${formatCount(group.verification.belumReview)} entri belum direview`}
          />
          <MetricBlock
            size="secondary"
            label="Koreksi Menunggu ACC"
            value={formatCount(group.corrections.pending)}
            tone={group.corrections.pending > 0 ? "warning" : "muted"}
            meta={`${formatCount(group.corrections.approved)} disetujui · ${formatCount(group.corrections.rejected)} ditolak`}
          />
        </MetricRow>
        <SectionCard className="mt-8" padded={false}>
          <QualityTable companies={report.companies} />
        </SectionCard>
      </section>
    </>
  );
}

/** Judul section — sengaja tanpa kotak; pemisah antar section adalah jarak. */
function SectionHeading({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <header className="flex items-start gap-2.5">
      {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </header>
  );
}
