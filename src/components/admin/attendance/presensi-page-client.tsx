"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconLogout,
  IconPencil,
  IconPlus,
  IconTrash,
  IconMapPinExclamation,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import {
  SectionCard,
  EmptyState,
  MetricRow,
  MetricBlock,
  ToolbarSpacer,
} from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { SegmentedFilter } from "@/components/admin/segmented-filter";
import {
  AdminFormSidebar,
  AdminFormFooter,
} from "@/components/admin/admin-form-sidebar";
import { WORK_START_LABEL } from "@/lib/attendance-time";

/* ── Tipe ─────────────────────────────────────────────────────────────────── */

export type AttendanceStatusKey =
  | "PRESENT"
  | "LATE"
  | "WFH"
  | "PERMISSION"
  | "SICK"
  | "LEAVE"
  | "ABSENT"
  | "HOLIDAY";

export type AttendanceRow = {
  userId: string;
  name: string;
  role: string;
  branchName: string;
  /** Cabang tempat clock-in benar-benar terjadi (rotasi antar cabang); null bila belum absen atau presensi manual. */
  checkInBranchName: string | null;
  companyId: string | null;
  /** Dihitung per karyawan di server, mengikuti scope tulis per PT. */
  canEdit: boolean;
  status: AttendanceStatusKey | null;
  /** ISO instant, null bila belum ada catatan. */
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
  isWithDoctorNote: boolean;
  isLocationSuspect: boolean;
  editedAt: string | null;
  editedByName: string | null;
};

export type CompanyOption = { id: string; name: string; code: string };

const PAGE_SIZE = 10;

/* ── Metadata status ──────────────────────────────────────────────────────── */

const STATUS_META: Record<AttendanceStatusKey, { label: string; badge: string }> = {
  PRESENT: { label: "Hadir", badge: "bg-success-muted text-success border-success/25" },
  LATE: {
    label: "Terlambat",
    badge: "bg-warning-muted text-warning-foreground border-warning/25",
  },
  WFH: { label: "WFH", badge: "bg-success-muted text-success border-success/25" },
  PERMISSION: { label: "Izin", badge: "bg-info-muted text-info border-info/25" },
  SICK: { label: "Sakit", badge: "bg-info-muted text-info border-info/25" },
  LEAVE: { label: "Cuti", badge: "bg-info-muted text-info border-info/25" },
  ABSENT: {
    label: "Alpa",
    badge: "bg-destructive/10 text-destructive border-destructive/25",
  },
  HOLIDAY: { label: "Libur", badge: "bg-muted text-muted-foreground border-border" },
};

const STATUS_ORDER = Object.keys(STATUS_META) as AttendanceStatusKey[];

/**
 * Status yang memang tidak punya jam masuk/pulang. Memilihnya lewat dropdown
 * langsung tersimpan tanpa menanyakan jam.
 */
const NON_WORKING: AttendanceStatusKey[] = [
  "PERMISSION",
  "SICK",
  "LEAVE",
  "ABSENT",
  "HOLIDAY",
];

/** Pilihan di dropdown "Absen" — urutannya mengikuti seberapa sering dipakai. */
const QUICK_STATUSES: AttendanceStatusKey[] = [
  "WFH",
  "PERMISSION",
  "SICK",
  "LEAVE",
  "ABSENT",
  "HOLIDAY",
];

/* ── Format waktu (selalu WIB, bukan zona browser) ────────────────────────── */

const WIB_TIME = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** ISO instant → `HH:mm` WIB. */
function toWibTime(iso: string | null): string {
  if (!iso) return "";
  return WIB_TIME.format(new Date(iso)).replace(".", ":");
}

/** `YYYY-MM-DD` + `HH:mm` → ISO instant pada offset WIB. */
function fromWibTime(dateKey: string, time: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const date = new Date(`${dateKey}T${time}:00.000+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const LONG_DATE = new Intl.DateTimeFormat("id-ID", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDateKey(dateKey: string) {
  return LONG_DATE.format(new Date(`${dateKey}T00:00:00.000Z`));
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Jam sekarang di WIB, `HH:mm` — nilai awal modal jam. */
function nowWibTime() {
  return WIB_TIME.format(new Date()).replace(".", ":");
}

/* ── State turunan ────────────────────────────────────────────────────────── */

type RowState = "belum" | "hadir" | "pulang" | "lain";

/**
 * Keadaan satu baris, meniru alur freshideas: sebuah baris tanpa catatan
 * menawarkan "Absen", yang sudah masuk tapi belum pulang menawarkan "Pulang",
 * dan status non-kehadiran tidak menawarkan keduanya.
 */
function rowState(row: AttendanceRow): RowState {
  if (!row.status) return "belum";
  if (NON_WORKING.includes(row.status)) return "lain";
  if (row.checkIn && !row.checkOut) return "hadir";
  if (row.checkIn && row.checkOut) return "pulang";
  return "lain";
}

type TimeModal = {
  userId: string;
  name: string;
  action: "check_in" | "check_out";
  time: string;
};

type EditDraft = {
  row: AttendanceRow;
  status: AttendanceStatusKey;
  checkIn: string;
  checkOut: string;
  notes: string;
  isWithDoctorNote: boolean;
};

/* ── Halaman ──────────────────────────────────────────────────────────────── */

export function PresensiPageClient({
  rows,
  companies,
  dateKey,
  companyId,
  todayKey,
  showCompanyFilter,
}: {
  rows: AttendanceRow[];
  companies: CompanyOption[];
  dateKey: string;
  companyId: string;
  todayKey: string;
  showCompanyFilter: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navPending, startNav] = useTransition();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AttendanceStatusKey | "NONE">("all");
  const [page, setPage] = useState(1);
  const [timeModal, setTimeModal] = useState<TimeModal | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  /** userId yang sedang dikirim aksinya, untuk mematikan tombol barisnya. */
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  /** Tanggal & PT tinggal di URL supaya datanya dirender ulang di server. */
  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) next.set(key, value);
    startNav(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "NONE" && row.status !== null) return false;
      if (statusFilter !== "all" && statusFilter !== "NONE" && row.status !== statusFilter)
        return false;
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        row.branchName.toLowerCase().includes(needle) ||
        row.role.toLowerCase().includes(needle)
      );
    });
  }, [rows, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Dijepit saat render, bukan lewat useEffect: filter yang menyusutkan daftar
  // bisa meninggalkan `page` di luar jangkauan, dan mengoreksinya di efek
  // berarti satu render menampilkan tabel kosong lebih dulu.
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    let unrecorded = 0;
    for (const row of rows) {
      if (row.status === null) unrecorded += 1;
      else counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return {
      total: rows.length,
      hadir: (counts.PRESENT ?? 0) + (counts.LATE ?? 0) + (counts.WFH ?? 0),
      late: counts.LATE ?? 0,
      wfh: counts.WFH ?? 0,
      berhalangan: (counts.PERMISSION ?? 0) + (counts.SICK ?? 0) + (counts.LEAVE ?? 0),
      izin: counts.PERMISSION ?? 0,
      sakit: counts.SICK ?? 0,
      cuti: counts.LEAVE ?? 0,
      alpa: counts.ABSENT ?? 0,
      libur: counts.HOLIDAY ?? 0,
      unrecorded,
    };
  }, [rows]);

  /* ── Panggilan API ──────────────────────────────────────────────────────── */

  async function send(userId: string, payload: Record<string, unknown>) {
    const res = await fetch("/api/attendance/manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, date: dateKey, ...payload }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.message || "Gagal menyimpan presensi");
    return json;
  }

  const run = async (
    userId: string,
    action: () => Promise<unknown>,
    successMessage: string
  ) => {
    setBusyUserId(userId);
    try {
      await action();
      toast.success(successMessage);
      // Baris dirender di server, jadi refresh — bukan menyalin hasil simpan ke
      // state klien, yang gampang melenceng dari isi DB.
      startNav(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan presensi");
    } finally {
      setBusyUserId(null);
    }
  };

  /** Status non-kehadiran: langsung tersimpan, tidak menanyakan jam. */
  const setQuickStatus = (row: AttendanceRow, status: AttendanceStatusKey) =>
    run(
      row.userId,
      () => send(row.userId, { status, checkIn: null, checkOut: null }),
      `${row.name} — ${STATUS_META[status].label} tercatat`
    );

  const openTimeModal = (row: AttendanceRow, action: "check_in" | "check_out") => {
    setTimeModal({
      userId: row.userId,
      name: row.name,
      action,
      // Jam sekarang cuma nilai awal — pengisinya boleh menggantinya, karena
      // presensi manual biasanya dicatat belakangan.
      time: nowWibTime(),
    });
  };

  /**
   * Membuka modal jam SETELAH dropdown selesai menutup.
   *
   * Radix mengembalikan fokus saat `DropdownMenu` unmount, dan dialog yang
   * dibuka pada tick yang sama ikut tertutup oleh dismissable-layer menu itu —
   * gejalanya menu hilang tapi modalnya tidak pernah muncul. Menundanya satu
   * macrotask membuat kedua lapisan tidak saling bertabrakan.
   */
  const openTimeModalAfterMenu = (
    row: AttendanceRow,
    action: "check_in" | "check_out"
  ) => {
    setTimeout(() => openTimeModal(row, action), 0);
  };

  const submitTimeModal = async () => {
    if (!timeModal) return;
    const iso = fromWibTime(dateKey, timeModal.time);
    if (!iso) {
      toast.error("Jam harus dalam format HH:MM");
      return;
    }
    const { userId, action, name } = timeModal;
    setTimeModal(null);
    await run(
      userId,
      () =>
        send(
          userId,
          action === "check_in" ? { checkIn: iso } : { checkOut: iso }
        ),
      action === "check_in"
        ? `${name} — absen masuk tercatat`
        : `${name} — absen pulang tercatat`
    );
  };

  const handleDelete = (row: AttendanceRow) =>
    run(
      row.userId,
      async () => {
        const res = await fetch(
          `/api/attendance/manage?userId=${encodeURIComponent(row.userId)}&date=${dateKey}`,
          { method: "DELETE" }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message || "Gagal menghapus catatan");
      },
      `Catatan presensi ${row.name} dihapus`
    );

  const openEditor = (row: AttendanceRow) => {
    setDraft({
      row,
      status: row.status ?? "PRESENT",
      checkIn: toWibTime(row.checkIn),
      checkOut: toWibTime(row.checkOut),
      notes: row.notes ?? "",
      isWithDoctorNote: row.isWithDoctorNote,
    });
  };

  const submitEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;

    const checkIn = draft.checkIn ? fromWibTime(dateKey, draft.checkIn) : null;
    const checkOut = draft.checkOut ? fromWibTime(dateKey, draft.checkOut) : null;
    if (draft.checkIn && !checkIn) {
      toast.error("Format jam masuk harus HH:MM");
      return;
    }
    if (draft.checkOut && !checkOut) {
      toast.error("Format jam pulang harus HH:MM");
      return;
    }

    setSaving(true);
    try {
      await send(draft.row.userId, {
        status: draft.status,
        checkIn,
        checkOut,
        notes: draft.notes,
        isWithDoctorNote: draft.isWithDoctorNote,
      });
      toast.success(`Presensi ${draft.row.name} diperbarui`);
      setDraft(null);
      startNav(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan presensi");
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const companyOptions = [
    { value: "all", label: "Semua PT" },
    ...companies.map((c) => ({ value: c.id, label: c.code || c.name, hint: c.name })),
  ];

  const isFuture = dateKey > todayKey;

  return (
    <div className="space-y-6">
      {/* Pemilih tanggal & PT */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Hari sebelumnya"
            onClick={() => setParam({ date: shiftDateKey(dateKey, -1) })}
          >
            <IconChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={dateKey}
            max={todayKey}
            onChange={(e) => e.target.value && setParam({ date: e.target.value })}
            className="tabular h-9 w-[10.5rem]"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Hari berikutnya"
            disabled={dateKey >= todayKey}
            onClick={() => setParam({ date: shiftDateKey(dateKey, 1) })}
          >
            <IconChevronRight className="size-4" />
          </Button>
          {dateKey !== todayKey ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setParam({ date: todayKey })}
            >
              Hari ini
            </Button>
          ) : (
            <Badge
              variant="outline"
              className="bg-success-muted text-success border-success/25 rounded-full px-2 py-0 text-[10px] font-medium tracking-wide uppercase"
            >
              Hari ini
            </Badge>
          )}
        </div>

        {showCompanyFilter && (
          <SegmentedFilter
            aria-label="Filter PT"
            value={companyId}
            onChange={(value) => setParam({ companyId: value })}
            options={companyOptions}
          />
        )}
      </div>

      {/* Ringkasan hari itu — blok data tanpa wadah (DATA_PRESENTATION) */}
      <MetricRow title={formatDateKey(dateKey)} columns={4}>
        <MetricBlock
          label="Hadir"
          value={summary.hadir.toLocaleString("id-ID")}
          suffix={<span className="text-muted-foreground text-sm">/ {summary.total}</span>}
          meta={`Terlambat ${summary.late} · WFH ${summary.wfh}`}
          tone={summary.hadir > 0 ? "success" : "default"}
        />
        <MetricBlock
          label="Tidak Masuk"
          value={summary.berhalangan.toLocaleString("id-ID")}
          meta={`Izin ${summary.izin} · Sakit ${summary.sakit} · Cuti ${summary.cuti}`}
        />
        <MetricBlock
          label="Alpa"
          value={summary.alpa.toLocaleString("id-ID")}
          meta={`Libur ${summary.libur}`}
          tone={summary.alpa > 0 ? "destructive" : "default"}
        />
        <MetricBlock
          label="Belum Absen"
          value={summary.unrecorded.toLocaleString("id-ID")}
          meta="Belum ada catatan sama sekali"
        />
      </MetricRow>

      <SectionCard
        title="Daftar Kehadiran"
        description={
          isFuture
            ? "Tanggal ini belum terjadi — presensi hanya bisa dicatat sampai hari ini."
            : "Catat presensi manual dengan jam yang bisa diisi sendiri, atau ubah status kehadiran."
        }
        padded={false}
        toolbar={
          <>
            <SearchInput
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Cari nama, cabang, atau jabatan..."
            />
            <Combobox
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as typeof statusFilter);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Semua status" },
                { value: "NONE", label: "Belum absen" },
                ...STATUS_ORDER.map((key) => ({
                  value: key,
                  label: STATUS_META[key].label,
                })),
              ]}
              placeholder="Semua status"
              searchPlaceholder="Cari status..."
              className="w-[10rem]"
            />
            <ToolbarSpacer />
            <span className="text-muted-foreground text-xs">
              {filtered.length} dari {rows.length} karyawan
            </span>
          </>
        }
        footer={
          totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <span>
                Halaman {safePage} dari {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          )
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={<IconUsersGroup className="size-5" />}
            title="Tidak ada karyawan"
            description={
              rows.length === 0
                ? "Belum ada karyawan aktif dalam jangkauan PT Anda."
                : "Tidak ada yang cocok dengan filter ini."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Jam Masuk</TableHead>
                  <TableHead className="text-center">Jam Pulang</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((row) => {
                  const meta = row.status ? STATUS_META[row.status] : null;
                  const state = rowState(row);
                  const busy = busyUserId === row.userId || navPending;
                  const actionable = row.canEdit && !isFuture;

                  return (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-muted-foreground text-xs">{row.role}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.branchName}
                        {row.checkInBranchName && row.checkInBranchName !== row.branchName && (
                          <div className="text-warning-foreground text-[11px] font-medium">
                            Absen di {row.checkInBranchName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {meta ? (
                            <Badge
                              variant="outline"
                              className={`rounded-full px-2 py-0 text-[10px] font-medium tracking-wide uppercase ${meta.badge}`}
                            >
                              {meta.label}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground rounded-full px-2 py-0 text-[10px] font-medium tracking-wide uppercase"
                            >
                              Belum
                            </Badge>
                          )}
                          {row.isLocationSuspect && (
                            <span
                              title="Lokasi GPS dan lokasi manual berbeda jauh"
                              className="text-warning"
                            >
                              <IconMapPinExclamation className="size-3.5" />
                            </span>
                          )}
                        </div>
                        {row.editedByName && (
                          <div className="text-muted-foreground mt-1 text-[11px]">
                            Dikoreksi {row.editedByName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-center text-sm">
                        {row.checkIn ? (
                          toWibTime(row.checkIn)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-center text-sm">
                        {row.checkOut ? (
                          toWibTime(row.checkOut)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Belum ada catatan → dropdown "Absen" */}
                          {actionable && state === "belum" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild disabled={busy}>
                                <Button type="button" size="sm" variant="outline">
                                  <IconPlus className="size-3.5" />
                                  Absen
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel className="text-xs">
                                  Catat kehadiran
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  onSelect={() => openTimeModalAfterMenu(row, "check_in")}
                                >
                                  <IconClock className="size-3.5" />
                                  Hadir — isi jam
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {QUICK_STATUSES.map((status) => (
                                  <DropdownMenuItem
                                    key={status}
                                    onSelect={() => void setQuickStatus(row, status)}
                                  >
                                    {STATUS_META[status].label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          {/* Sudah masuk, belum pulang → tombol Pulang */}
                          {actionable && state === "hadir" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => openTimeModal(row, "check_out")}
                            >
                              <IconLogout className="size-3.5" />
                              Pulang
                            </Button>
                          )}

                          {actionable ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Ubah presensi ${row.name}`}
                                disabled={busy}
                                onClick={() => openEditor(row)}
                              >
                                <IconPencil className="size-4" />
                              </Button>
                              {row.status && (
                                <DeleteConfirmDialog
                                  title="Hapus catatan presensi ini?"
                                  description={`Catatan ${row.name} pada ${formatDateKey(dateKey)} akan dihapus dan kembali menjadi "belum absen".`}
                                  loading={busy}
                                  onConfirm={() => void handleDelete(row)}
                                  trigger={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Hapus presensi ${row.name}`}
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      <IconTrash className="size-4" />
                                    </Button>
                                  }
                                />
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              Hanya lihat
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Modal jam — dipakai untuk absen masuk maupun pulang */}
      <AlertDialog
        open={timeModal !== null}
        onOpenChange={(open) => !open && setTimeModal(null)}
      >
        <AlertDialogContent className="sm:max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm">
              <IconClock className="text-muted-foreground size-4" />
              {timeModal?.action === "check_in" ? "Jam Masuk" : "Jam Pulang"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {timeModal?.name} · {formatDateKey(dateKey)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            type="time"
            autoFocus
            value={timeModal?.time ?? ""}
            onChange={(e) =>
              setTimeModal((prev) => (prev ? { ...prev, time: e.target.value } : prev))
            }
            className="tabular h-14 text-center text-2xl font-semibold"
          />
          <p className="text-muted-foreground text-xs">
            Waktu WIB. Jam masuk lewat {WORK_START_LABEL} otomatis dicatat terlambat.
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button type="button" onClick={() => void submitTimeModal()}>
              Simpan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Editor presensi lengkap */}
      {draft && (
        <AdminFormSidebar
          open
          onOpenChange={(open) => !open && setDraft(null)}
          title={`Presensi — ${draft.row.name}`}
          description={`${draft.row.branchName} · ${formatDateKey(dateKey)}`}
          icon={<IconPencil className="size-5" />}
          onSubmit={submitEditor}
          footer={
            <AdminFormFooter
              onCancel={() => setDraft(null)}
              loading={saving}
              submitLabel="Simpan presensi"
            />
          }
        >
          <div className="space-y-2">
            <Label htmlFor="att-status">Status kehadiran</Label>
            <Combobox
              id="att-status"
              value={draft.status}
              onValueChange={(value) => {
                const status = value as AttendanceStatusKey;
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        status,
                        // Status tanpa kehadiran fisik tidak boleh menyisakan
                        // jam masuk lama — angka itu ikut ke potongan gaji.
                        checkIn: NON_WORKING.includes(status) ? "" : prev.checkIn,
                        checkOut: NON_WORKING.includes(status) ? "" : prev.checkOut,
                      }
                    : prev
                );
              }}
              options={STATUS_ORDER.map((key) => ({
                value: key,
                label: STATUS_META[key].label,
              }))}
              searchPlaceholder="Cari status..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="att-checkin">Jam masuk (WIB)</Label>
              <Input
                id="att-checkin"
                type="time"
                value={draft.checkIn}
                disabled={NON_WORKING.includes(draft.status)}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, checkIn: e.target.value } : prev))
                }
                className="tabular"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="att-checkout">Jam pulang (WIB)</Label>
              <Input
                id="att-checkout"
                type="time"
                value={draft.checkOut}
                disabled={NON_WORKING.includes(draft.status) || !draft.checkIn}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, checkOut: e.target.value } : prev))
                }
                className="tabular"
              />
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Kosongkan jam untuk menghapusnya. Jam masuk yang lewat batas {WORK_START_LABEL} otomatis
            dinilai terlambat kecuali Anda memilih status lain.
          </p>

          {(draft.status === "PERMISSION" || draft.status === "SICK") && (
            <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
              <div>
                <Label htmlFor="att-note">Dengan surat dokter</Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Memengaruhi potongan gaji dan penilaian kedisiplinan KPI.
                </p>
              </div>
              <Switch
                id="att-note"
                checked={draft.isWithDoctorNote}
                onCheckedChange={(checked) =>
                  setDraft((prev) => (prev ? { ...prev, isWithDoctorNote: checked } : prev))
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="att-notes">Catatan</Label>
            <Textarea
              id="att-notes"
              rows={3}
              value={draft.notes}
              placeholder="Alasan koreksi, mis. mesin absen error"
              onChange={(e) =>
                setDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
              }
            />
          </div>

          {draft.row.editedByName && draft.row.editedAt && (
            <p className="text-muted-foreground text-xs">
              Terakhir dikoreksi oleh {draft.row.editedByName} pada{" "}
              {new Date(draft.row.editedAt).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
                dateStyle: "medium",
                timeStyle: "short",
              })}
              .
            </p>
          )}
        </AdminFormSidebar>
      )}
    </div>
  );
}
