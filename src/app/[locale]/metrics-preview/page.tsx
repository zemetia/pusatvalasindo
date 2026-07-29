// TEMPORARY visual harness for docs/blueprint/DATA_PRESENTATION.md — delete after review.
import {
  PageShell,
  PageHeader,
  MetricRow,
  MetricBlock,
  MetricInline,
} from "@/components/admin/page-shell";

export default function MetricsPreviewPage() {
  return (
    <PageShell className="py-8">
      <PageHeader
        eyebrow="Blueprint"
        title="Paradigma Penyajian Data"
        description="Blok data editorial — tanpa kartu, tanpa border per metrik."
      />

      <MetricRow title="Ringkasan Bisnis" columns={4}>
        <MetricBlock
          label="Saldo Bank"
          prefix="Rp"
          value="1.284.500.000"
          delta={4.2}
          period="vs hari sebelumnya"
          meta="7 rekening IDR · USD 128.400 · SGD 42.100"
        />
        <MetricBlock
          label="Presensi Hari Ini"
          value="38"
          suffix="dari 42"
          meta="90% karyawan hadir"
        />
        <MetricBlock
          label="KPI Bulan Ini"
          value="87,4"
          delta={-2.4}
          period="vs bulan lalu"
          meta="Rata-rata skor tim · 214 entri"
        />
        <MetricBlock
          label="Biaya Operasional"
          prefix="Rp"
          value="412.700.000"
          delta={-6.1}
          deltaGoodWhen="down"
          period="vs bulan lalu"
          meta="Metrik terbalik — turun berarti membaik"
        />
      </MetricRow>

      <MetricRow title="Organisasi" columns={2} className="-mt-px">
        <MetricBlock label="Karyawan Aktif" size="secondary" value="42" meta="Total karyawan terdaftar" />
        <MetricBlock label="Cabang Aktif" size="secondary" value="6" meta="Cabang beroperasi" />
      </MetricRow>

      <section className="border-border grid gap-8 border-y py-8 sm:grid-cols-3 -mt-px">
        <div className="sm:col-span-2">
          <MetricBlock
            label="Saldo Saat Ini"
            size="hero"
            prefix="IDR"
            value="1.284.500.000,00"
            meta="Rekening aktif"
          />
        </div>
        <div className="space-y-2.5 sm:border-l sm:pl-8">
          <MetricInline label="PT" value="PT Pusat Valas Indo" />
          <MetricInline label="Pemilik Rekening" value="Budi Santoso" />
          <MetricInline label="Jumlah Mutasi" value="1.482" />
          <MetricInline label="Selisih Kas" value="0" tone="success" />
        </div>
      </section>
    </PageShell>
  );
}
