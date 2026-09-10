import Link from "next/link";
import { IconFingerprint } from "@tabler/icons-react";

import prisma from "@/lib/prisma";
import { requireResource } from "@/backend/helpers/authz";
import { jakartaMinutesOfDay, jakartaDateIso } from "@/lib/attendance-time";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  ErrorPanel,
  MetricBlock,
  MetricRow,
  PageHeader,
  PageShell,
  SectionCard,
} from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { LoginHistoryDeleteButton } from "@/components/admin/users/login-history-delete-button";

/**
 * Riwayat login: satu baris per sesi yang dibuat Better Auth (`session.createdAt`
 * = saat pengguna itu login). Bukan audit log khusus — sistem ini belum punya
 * tabel log login terpisah — tapi setiap login membuat baris sesi baru, jadi
 * `createdAt`-nya adalah jam login yang sebenarnya.
 */

/** Jendela jam login yang dianggap wajar (WIB). Di luar ini ditandai —
 *  bukan diblokir, hanya sorotan untuk diperiksa manual. Sengaja lebih
 *  lebar dari jam masuk kantor (lihat lib/attendance-time.ts): banyak login
 *  sah terjadi sebelum jam masuk untuk presensi, dan owner/HR wajar login
 *  malam untuk urusan admin — di luar 05.00–22.00 baru dianggap tidak wajar. */
const NORMAL_WINDOW = { startMinute: 5 * 60, endMinute: 22 * 60 };

function isOutsideNormalHours(date: Date): boolean {
  const minutes = jakartaMinutesOfDay(date);
  return minutes < NORMAL_WINDOW.startMinute || minutes >= NORMAL_WINDOW.endMinute;
}

const DATETIME = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

const PERIOD_OPTIONS = [
  { days: 1, label: "24 jam" },
  { days: 7, label: "7 hari" },
  { days: 30, label: "30 hari" },
] as const;

const ROW_LIMIT = 1000;
const PER_PAGE = 25;

/** Ringkasan singkat user-agent — cukup untuk membedakan HP/laptop/browser
 *  tanpa menampilkan string mentah yang panjang dan tidak enak dibaca. */
function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "—";
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  let browser = "Browser lain";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  return `${browser} · ${isMobile ? "HP" : "Komputer"}`;
}

type Params = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ rentang?: string; luarJamKerja?: string; halaman?: string }>;
};

/** Query string halaman ini, dengan bagian yang diberikan di `overrides`
 *  ditimpa — dipakai supaya setiap tautan (periode, filter, paginasi) tetap
 *  membawa parameter lain yang sedang aktif. */
function buildHref(
  current: { rentang: number; luarJamKerja: boolean; halaman: number },
  overrides: Partial<{ rentang: number; luarJamKerja: boolean; halaman: number }>
): string {
  const next = { ...current, ...overrides };
  const params = new URLSearchParams();
  params.set("rentang", String(next.rentang));
  if (next.luarJamKerja) params.set("luarJamKerja", "1");
  if (next.halaman > 1) params.set("halaman", String(next.halaman));
  return `/dashboard/users/login-history?${params.toString()}`;
}

export default async function LoginHistoryPage({ params, searchParams }: Params) {
  const { locale } = await params;
  const { rentang, luarJamKerja, halaman } = await searchParams;

  // Resource lintas seluruh pengguna — bukan scoping per PT — jadi gerbangnya
  // hanya boleh/tidak boleh, tanpa dipersempit `authz.where()`.
  const authz = await requireResource("users.login-history", "view", locale);
  const canDelete = authz.can("users.login-history", "write");

  const requestedDays = Number(rentang);
  const days = PERIOD_OPTIONS.some((o) => o.days === requestedDays) ? requestedDays : 7;
  const onlyOutside = luarJamKerja === "1";
  const requestedPage = Number(halaman);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  let sessions;
  let expiredCount = 0;
  try {
    [sessions, expiredCount] = await Promise.all([
      prisma.session.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true,
          createdAt: true,
          ipAddress: true,
          userAgent: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              customRole: { select: { name: true } },
              branch: { select: { name: true, company: { select: { code: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: ROW_LIMIT,
      }),
      // Dihitung terpisah dari `days`: tombol hapus membersihkan SELURUH sesi
      // kedaluwarsa, bukan cuma yang kebetulan ada di rentang yang sedang dilihat.
      canDelete ? prisma.session.count({ where: { expiresAt: { lt: now } } }) : Promise.resolve(0),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="users/login-history/page" message={msg} />;
  }

  const rows = sessions.map((s) => ({
    ...s,
    outside: isOutsideNormalHours(s.createdAt),
  }));

  const outsideCount = rows.filter((r) => r.outside).length;
  const uniqueUsers = new Set(rows.map((r) => r.user.id)).size;
  const today = jakartaDateIso();
  const loginsToday = rows.filter((r) => jakartaDateIso(r.createdAt) === today).length;

  const filteredRows = onlyOutside ? rows.filter((r) => r.outside) : rows;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const filterState = { rentang: days, luarJamKerja: onlyOutside, halaman: currentPage };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Manajemen"
        title="Riwayat Login"
        icon={<IconFingerprint className="size-5" />}
        description="Setiap kali seseorang login ke sistem, beserta jam WIB-nya — untuk memeriksa apakah ada yang masuk di luar jam kerja."
        action={
          <>
            <div className="bg-muted/60 inline-flex items-center gap-1 rounded-lg p-1">
              {PERIOD_OPTIONS.map((o) => (
                <Link
                  key={o.days}
                  href={buildHref(filterState, { rentang: o.days, halaman: 1 })}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    o.days === days
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {o.label}
                </Link>
              ))}
            </div>
            {canDelete && <LoginHistoryDeleteButton expiredCount={expiredCount} />}
          </>
        }
      />

      <MetricRow columns={3} bordered={false} className="border-b pb-8">
        <MetricBlock
          label={`Total Login — ${PERIOD_OPTIONS.find((o) => o.days === days)?.label}`}
          value={formatCount(rows.length)}
          meta={rows.length >= ROW_LIMIT ? `Menampilkan ${ROW_LIMIT} login terbaru` : undefined}
        />
        <MetricBlock
          label="Login Hari Ini"
          value={formatCount(loginsToday)}
        />
        <MetricBlock
          label="Login di Luar Jam Kerja"
          value={formatCount(outsideCount)}
          tone={outsideCount > 0 ? "destructive" : "default"}
          meta={`Dari ${formatCount(uniqueUsers)} pengguna berbeda · di luar 05.00–22.00 WIB`}
        />
      </MetricRow>

      <SectionCard
        title="Daftar Login"
        description="Diurutkan dari yang paling baru. Baris di luar jam kerja ditandai merah."
        toolbar={
          <Link
            href={buildHref(filterState, { luarJamKerja: !onlyOutside, halaman: 1 })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              onlyOutside
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {onlyOutside ? "✓ " : ""}Hanya luar jam kerja
          </Link>
        }
        padded={false}
        footer={
          filteredRows.length > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span>
                Halaman {currentPage} dari {totalPages} · {formatCount(filteredRows.length)} baris
              </span>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={buildHref(filterState, { halaman: currentPage - 1 })}
                    aria-disabled={currentPage <= 1}
                    tabIndex={currentPage <= 1 ? -1 : undefined}
                    className={cn(currentPage <= 1 && "pointer-events-none opacity-50")}
                  >
                    Sebelumnya
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={buildHref(filterState, { halaman: currentPage + 1 })}
                    aria-disabled={currentPage >= totalPages}
                    tabIndex={currentPage >= totalPages ? -1 : undefined}
                    className={cn(currentPage >= totalPages && "pointer-events-none opacity-50")}
                  >
                    Berikutnya
                  </Link>
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {visibleRows.length === 0 ? (
          <EmptyState
            icon={<IconFingerprint className="size-5" />}
            title="Tidak ada login pada rentang ini"
            description={
              onlyOutside
                ? "Tidak ada login di luar jam kerja pada rentang waktu yang dipilih."
                : "Belum ada sesi login yang tercatat pada rentang waktu yang dipilih."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu Login (WIB)</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Perangkat</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular text-sm whitespace-nowrap">
                    {DATETIME.format(r.createdAt)}
                    {r.outside && (
                      <Badge variant="destructive" className="ml-2">
                        Luar jam kerja
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.user.name}</div>
                    <div className="text-muted-foreground text-xs">{r.user.email}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.user.customRole?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.user.branch ? (
                      <>
                        {r.user.branch.name}
                        {r.user.branch.company?.code && (
                          <Badge variant="outline" className="ml-1.5">
                            {r.user.branch.company.code}
                          </Badge>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {summarizeUserAgent(r.userAgent)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.ipAddress ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </PageShell>
  );
}
