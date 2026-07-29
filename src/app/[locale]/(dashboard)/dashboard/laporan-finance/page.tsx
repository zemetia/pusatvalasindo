import { IconReportMoney } from "@tabler/icons-react";

import { requireGlobalPageCaller } from "@/backend/helpers/page-access";
import {
  financeReportService,
  type FinanceReport,
} from "@/backend/services/finance-report.service";
import prisma from "@/lib/prisma";
import {
  addMonths,
  monthKey,
  resolvePeriod,
  todayKey,
  type PeriodRange,
} from "@/lib/finance-period";
import { EmptyState, ErrorPanel, PageHeader, PageShell } from "@/components/admin/page-shell";
import { FinancePeriodPicker } from "@/components/admin/finance/finance-period-picker";
import { FinanceReportView } from "@/components/admin/finance/finance-report-view";

/**
 * Laporan Finance (Owner).
 *
 * Laporan keuangan per satuan waktu untuk seluruh PT sekaligus: posisi aset
 * (stock + kas + bank) hasil cross-check kepala cabang, perubahannya sepanjang
 * periode, komposisinya, kalender harian, cross-check, dan kualitas datanya.
 *
 * Seluruh halaman dirender di server dan seluruh state periode hidup di URL
 * (`?periode=&dari=&sampai=&pt=&bulan=`) — tidak ada endpoint client, tidak ada
 * fetch setelah hydrate, dan satu periode tertentu bisa langsung dibagikan lewat
 * tautan.
 *
 * Batas akses: peran global saja (Owner & Super Admin). Kepala Cabang tidak
 * boleh masuk karena isinya lintas PT.
 */

type SearchParams = {
  periode?: string;
  dari?: string;
  sampai?: string;
  pt?: string;
  bulan?: string;
};

export default async function LaporanFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  await requireGlobalPageCaller(locale);

  const query = await searchParams;
  const range = resolvePeriod({
    preset: query.periode,
    from: query.dari,
    to: query.sampai,
  });

  // Pengambilan data dipisah dari render: JSX tidak boleh dibangun di dalam
  // try/catch (React merender belakangan, jadi error render tidak tertangkap di
  // sana — aturan lint `react-hooks/error-boundaries`).
  const loaded = await loadReport(range, query.pt);

  if (!loaded.ok) {
    return <ErrorPanel source="laporan-finance/page" message={loaded.message} />;
  }

  const { companies, activeCompanyId, report } = loaded;

  if (!report) {
    return (
      <PageShell>
        <Header range={range} companies={companies} activeCompanyId={null} />
        <EmptyState
          icon={<IconReportMoney className="size-5" />}
          title="Belum ada PT aktif"
          description="Laporan finance menampilkan posisi keuangan per PT. Aktifkan minimal satu PT terlebih dahulu."
        />
      </PageShell>
    );
  }

  /* ── Tautan yang mempertahankan filter aktif ─────────────────────────────── */
  const withParams = (extra: Record<string, string>) => {
    const search = new URLSearchParams();
    if (activeCompanyId) search.set("pt", activeCompanyId);
    search.set("periode", range.preset);
    if (range.preset === "custom") {
      search.set("dari", range.from);
      search.set("sampai", range.to);
    }
    for (const [key, value] of Object.entries(extra)) search.set(key, value);
    return `?${search.toString()}`;
  };

  /** Klik satu tanggal di kalender = laporan satu hari itu. */
  const dayHref = (date: string) => {
    const search = new URLSearchParams();
    if (activeCompanyId) search.set("pt", activeCompanyId);
    search.set("periode", "custom");
    search.set("dari", date);
    search.set("sampai", date);
    return `?${search.toString()}`;
  };

  // Kalender hanya boleh menjelajah bulan yang datanya memang sudah diambil,
  // yaitu rentang periode plus periode pembandingnya.
  const firstMonth = monthKey(range.prevFrom);
  const lastMonth = monthKey(range.to);
  const requestedMonth = query.bulan && /^\d{4}-\d{2}$/.test(query.bulan) ? query.bulan : lastMonth;
  const calendarMonth =
    requestedMonth < firstMonth
      ? firstMonth
      : requestedMonth > lastMonth
        ? lastMonth
        : requestedMonth;
  const prevMonth = addMonths(calendarMonth, -1);
  const nextMonth = addMonths(calendarMonth, 1);

  return (
    <PageShell className="gap-10">
      <Header range={range} companies={companies} activeCompanyId={activeCompanyId} />
      <FinanceReportView
        report={report}
        today={todayKey()}
        calendarMonth={calendarMonth}
        calendarPrevHref={prevMonth >= firstMonth ? withParams({ bulan: prevMonth }) : null}
        calendarNextHref={nextMonth <= lastMonth ? withParams({ bulan: nextMonth }) : null}
        dayHref={dayHref}
      />
    </PageShell>
  );
}

type LoadResult =
  | {
      ok: true;
      companies: { id: string; name: string }[];
      activeCompanyId: string | null;
      /** `null` saat belum ada PT aktif sama sekali. */
      report: FinanceReport | null;
    }
  | { ok: false; message: string };

/**
 * Mengambil daftar PT + laporannya. Kegagalan dikembalikan sebagai nilai, bukan
 * dilempar, supaya halaman bisa merender `ErrorPanel` tanpa membungkus JSX dalam
 * try/catch.
 */
async function loadReport(range: PeriodRange, ptParam?: string): Promise<LoadResult> {
  try {
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    if (companies.length === 0) {
      return { ok: true, companies, activeCompanyId: null, report: null };
    }

    // Filter PT: nilai asing diabaikan (jatuh ke seluruh PT) daripada
    // menghasilkan laporan kosong yang membingungkan.
    const activeCompanyId =
      ptParam && companies.some((company) => company.id === ptParam) ? ptParam : null;
    const companyIds = activeCompanyId ? [activeCompanyId] : companies.map((c) => c.id);

    return {
      ok: true,
      companies,
      activeCompanyId,
      report: await financeReportService.getReport(companyIds, range),
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function Header({
  range,
  companies,
  activeCompanyId,
}: {
  range: PeriodRange;
  companies: { id: string; name: string }[];
  activeCompanyId: string | null;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Owner"
        title="Laporan Finance"
        description="Posisi keuangan konsolidasi seluruh PT per satuan waktu — stock, kas, bank, dan hasil cross-check."
        icon={<IconReportMoney className="size-5" />}
      />
      {/* `key` berisi rentang aktif: begitu periode berubah dari luar (klik
          tanggal di kalender, tombol back), picker di-remount sehingga draft
          input custom-nya ikut tereset — tanpa menyalin prop ke state. */}
      <FinancePeriodPicker
        key={`${range.preset}:${range.from}:${range.to}`}
        range={range}
        companies={companies}
        activeCompanyId={activeCompanyId}
      />
    </>
  );
}
