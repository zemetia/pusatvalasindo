"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  MetricBlock,
  MetricRow,
  SectionCard,
  EmptyState,
} from "@/components/admin/page-shell"
import {
  IconAlertTriangle,
  IconCheck,
  IconClockDollar,
  IconLoader2,
  IconMinus,
  IconPlus,
  IconRotate2,
  IconTrash,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useGridKeyboardNav } from "@/hooks/use-grid-keyboard-nav"

/* ── Bentuk data ──────────────────────────────────────────────────────────── */

type Company = { id: string; name: string }

type SaveState = "idle" | "saving" | "saved" | "error"

/** Baris apa adanya dari server. */
type ServerRow = {
  id: string
  name: string
  amount: string
  note: string | null
  settledAt: string | null
}

type Payload = {
  serverDate?: string | null
  rows?: ServerRow[]
  outstanding?: { total: number; count: number }
}

/** Baris + draft yang sedang diketik. `saved*` yang menentukan perlu-tidaknya simpan. */
type Row = ServerRow & {
  savedName: string
  savedAmount: string
  saveState: SaveState
}

const LAST_SELECTION_KEY = "dana-tertahan:last-company"

/** Navigasi ala spreadsheet: panah atas/bawah antar baris, Tab antar kolom. */
const NAV_COLUMNS = ["name", "amount"] as const
const NAV_SELECT_ON_FOCUS = ["amount"] as const

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 })
}

function parseNum(s: string): number {
  const cleaned = s.replace(/[^\d.-]/g, "")
  return parseFloat(cleaned) || 0
}

function toRow(r: ServerRow): Row {
  return { ...r, savedName: r.name, savedAmount: r.amount, saveState: "idle" }
}

function readLastSelection(): string | null {
  try {
    return window.localStorage.getItem(LAST_SELECTION_KEY)
  } catch {
    return null
  }
}

/**
 * PT terakhir yang dipilih, dibaca lewat `useSyncExternalStore` alih-alih
 * `useEffect` + `setState`.
 *
 * Dua alasan, keduanya bukan soal gaya: (1) render pertama di server tidak punya
 * `localStorage`, dan `getServerSnapshot` yang mengembalikan `null` membuat HTML
 * server & hydration klien sepakat — tanpa itu nilainya berbeda dan React
 * membuang seluruh subtree; (2) `setState` di dalam efek memicu render bertingkat
 * dan dilarang di repo ini (lint `react-hooks/set-state-in-effect`).
 *
 * `subscribe` sengaja no-op: preferensi ini hanya perlu dibaca sekali saat mount,
 * dan tidak ada tab lain yang boleh menggeser pilihan PT di tengah pengisian.
 */
const NO_SUBSCRIBE = () => () => {}
const NO_SERVER_VALUE = () => null

interface Props {
  companies: Company[]
  defaultCompanyId: string | null
  /** PT yang boleh diisi/diubah; `null` = semua PT. */
  writableCompanyIds: string[] | null
  /** PT yang boleh dinyatakan lunas (izin `finance.receivable.settle`); `null` = semua. */
  settleCompanyIds: string[] | null
  /** PT yang boleh diubah untuk tanggal lampau (izin `daily.backdate`); `null` = semua. */
  backdateCompanyIds: string[] | null
  canSelectCompany: boolean
  /** Payload hari ini yang sudah dirender server. */
  initialData?: unknown
  /** `${companyId}:${YYYY-MM-DD}` milik initialData — dipakai hanya kalau cocok. */
  initialKey?: string | null
}

/**
 * Dana Tertahan: hutang orang ke perusahaan, dicatat per tanggal.
 *
 * Tiga izin yang berbeda bertemu di satu tabel, dan UI-nya harus jujur soal
 * ketiganya — server tetap yang memutuskan, tapi input yang pasti ditolak tidak
 * boleh terlihat bisa diketik:
 *
 * • `finance.receivable` (tulis) → tambah, ubah nama & jumlah, hapus
 * • `daily.backdate`             → tambahan wajib untuk tanggal lampau
 * • `finance.receivable.settle`  → tandai lunas / batalkan, hari ini & lampau
 *
 * Tombol "Lunas" karena itu tetap aktif untuk hari berjalan: uang bisa tiba-tiba
 * masuk di hari yang sama, dan tidak masuk akal menunggu besok untuk mencatatnya.
 */
export function HeldFundPageClient({
  companies,
  defaultCompanyId,
  writableCompanyIds,
  settleCompanyIds,
  backdateCompanyIds,
  canSelectCompany,
  initialData,
  initialKey,
}: Props) {
  const [date, setDate] = useState(() => toDateKey(new Date()))

  // PT aktif = pilihan eksplisit user di sesi ini, kalau belum ada baru PT yang
  // tersimpan dari kunjungan sebelumnya, baru PT bawaan. Disusun sebagai nilai
  // turunan (bukan satu state yang ditimpa efek) supaya tidak ada momen di mana
  // pilihan user ditindih oleh nilai tersimpan.
  const [picked, setPicked] = useState<string | null>(null)
  const savedCompanyId = useSyncExternalStore(NO_SUBSCRIBE, readLastSelection, NO_SERVER_VALUE)
  const restored =
    canSelectCompany && savedCompanyId && companies.some((c) => c.id === savedCompanyId)
      ? savedCompanyId
      : null
  const companyId = picked ?? restored ?? defaultCompanyId ?? ""

  const selectCompany = (id: string) => {
    setPicked(id)
    // Penulisan preferensi adalah respons terhadap sebuah kejadian, jadi tempatnya
    // di handler — bukan di efek yang mengejar perubahan state.
    try {
      window.localStorage.setItem(LAST_SELECTION_KEY, id)
    } catch {
      // Mode privat / storage penuh: kehilangan preferensi tidak boleh
      // menggagalkan perpindahan PT.
    }
  }

  // Payload server hanya sah untuk kombinasi PT + tanggal saat halaman dirender.
  // Dihitung sekali dan tidak pernah berubah — begitu user ganti PT/tanggal,
  // datanya selalu datang dari fetch.
  const [seed] = useState<Payload | null>(() =>
    initialData && initialKey && initialKey === `${defaultCompanyId ?? ""}:${toDateKey(new Date())}`
      ? (initialData as Payload)
      : null
  )

  const [rows, setRows] = useState<Row[]>(() => (seed?.rows ?? []).map(toRow))
  const [outstanding, setOutstanding] = useState(() => seed?.outstanding ?? { total: 0, count: 0 })
  const [serverDate, setServerDate] = useState<string | null>(() => seed?.serverDate ?? null)
  const [fetching, setFetching] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const inScope = (list: string[] | null) =>
    !!companyId && (list === null || list.includes(companyId))

  // Ketiga hak dihitung dari PT yang SEDANG dipilih, bukan sekali dari PT bawaan —
  // scope lihat, ubah, dan lunas bisa mencakup PT yang berbeda-beda.
  const canManage = inScope(writableCompanyIds)
  const canSettle = inScope(settleCompanyIds)
  const canBackdate = inScope(backdateCompanyIds)

  // `serverDate` datang dari server supaya jam browser yang salah tidak membuka
  // tanggal lampau untuk diedit.
  const isPast = serverDate !== null && date < serverDate
  /** Isi baris hanya bisa diubah kalau tanggalnya masih boleh disentuh. */
  const canEditContent = canManage && (!isPast || canBackdate)

  const { registerCell, handleCellKeyDown } = useGridKeyboardNav({
    columns: NAV_COLUMNS,
    rowCount: rows.length,
    selectOnFocus: NAV_SELECT_ON_FOCUS,
  })

  /* ── Muat data ──────────────────────────────────────────────────────────── */

  const loadData = useCallback(async () => {
    if (!companyId || !date) return
    setFetching(true)
    try {
      const res = await fetch(`/api/dana-tertahan?companyId=${companyId}&date=${date}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || data.message || "Gagal memuat data")
        setRows([])
        return
      }
      const payload = data.data as Payload
      setServerDate(payload.serverDate ?? null)
      setRows((payload.rows ?? []).map(toRow))
      setOutstanding(payload.outstanding ?? { total: 0, count: 0 })
    } catch {
      toast.error("Gagal memuat data")
      setRows([])
    } finally {
      setFetching(false)
    }
  }, [companyId, date])

  // Kalau baris awal sudah datang bersama HTML, lewati fetch pertama.
  const skipFirstLoadRef = useRef(seed !== null)
  useEffect(() => {
    if (skipFirstLoadRef.current) {
      skipFirstLoadRef.current = false
      return
    }
    loadData()
  }, [loadData])

  /* ── Mutasi ─────────────────────────────────────────────────────────────── */

  // Baris yang sedang dioperasikan selalu DIKIRIM oleh pemanggilnya, tidak dicari
  // lewat ref: setiap handler di bawah dipicu oleh event pada satu baris, dan
  // baris itu sudah ada di tangan `HeldFundRow`. Menyimpan salinan `rows` di ref
  // hanya untuk dicari ulang berarti membaca ref saat render — dilarang lint
  // `react-hooks/purity`, dan memang tidak perlu di sini.

  const patchRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const updateDraft = (id: string, field: "name" | "amount", val: string) =>
    patchRow(id, { [field]: val } as Partial<Row>)

  /**
   * Autosave saat kehilangan fokus — tidak ada tombol simpan di grid ini.
   * Baris yang isinya tidak berubah tidak menembakkan request sama sekali, jadi
   * sekadar melewati sel tidak membebani DB remote.
   */
  const saveRow = async (row: Row) => {
    if (!canEditContent) return

    const nameChanged = row.name.trim() !== row.savedName
    const amountChanged = parseNum(row.amount) !== parseNum(row.savedAmount)
    if (!nameChanged && !amountChanged) return

    // Nama kosong bukan perubahan yang sah — dipulihkan, bukan disimpan sebagai "".
    if (nameChanged && !row.name.trim()) {
      patchRow(row.id, { name: row.savedName })
      toast.error("Nama tidak boleh kosong")
      return
    }

    patchRow(row.id, { saveState: "saving" })
    try {
      const res = await fetch(`/api/dana-tertahan/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(nameChanged ? { name: row.name.trim() } : {}),
          ...(amountChanged ? { amount: parseNum(row.amount) } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")

      const delta = parseNum(row.amount) - parseNum(row.savedAmount)
      patchRow(row.id, {
        name: row.name.trim(),
        savedName: row.name.trim(),
        savedAmount: row.amount,
        saveState: "saved",
      })
      // Baris yang belum lunas ikut mengubah posisi tertahan seketika — tanpa ini
      // angka besar di atas baru benar setelah reload.
      if (!row.settledAt && delta !== 0) {
        setOutstanding((o) => ({ ...o, total: o.total + delta }))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      patchRow(row.id, { saveState: "error" })
    }
  }

  const addRow = async (name: string) => {
    const res = await fetch("/api/dana-tertahan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, date, name }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menambah")

    const created = data.data as ServerRow
    setRows((prev) => [...prev, toRow(created)])
    setOutstanding((o) => ({ ...o, count: o.count + 1 }))
  }

  const setSettled = async (row: Row, settled: boolean) => {
    patchRow(row.id, { saveState: "saving" })
    try {
      const res = await fetch(`/api/dana-tertahan/${row.id}/lunas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settled }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")

      // Angka yang dipakai adalah yang SUDAH tersimpan, bukan draft yang sedang
      // diketik — kalau tidak, posisi tertahan bergeser memakai angka yang belum
      // pernah sampai ke server.
      const amount = parseNum(row.savedAmount)
      patchRow(row.id, { settledAt: (data.data as ServerRow).settledAt, saveState: "idle" })
      setOutstanding((o) => ({
        total: settled ? o.total - amount : o.total + amount,
        count: settled ? o.count - 1 : o.count + 1,
      }))
      toast.success(data.message ?? (settled ? "Ditandai lunas" : "Ditandai belum lunas"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      patchRow(row.id, { saveState: "error" })
    }
  }

  const removeRow = async (row: Row) => {
    const confirmed = window.confirm(
      `Hapus catatan "${row.savedName}"? Untuk hutang yang sudah dibayar, pakai tombol Lunas agar jejaknya tetap ada.`
    )
    if (!confirmed) return

    patchRow(row.id, { saveState: "saving" })
    try {
      const res = await fetch(`/api/dana-tertahan/${row.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menghapus")

      setRows((prev) => prev.filter((r) => r.id !== row.id))
      if (!row.settledAt) {
        setOutstanding((o) => ({
          total: o.total - parseNum(row.savedAmount),
          count: o.count - 1,
        }))
      }
      toast.success("Catatan dihapus")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
      patchRow(row.id, { saveState: "error" })
    }
  }

  /* ── Ringkasan tanggal yang dibuka ──────────────────────────────────────── */

  const totals = useMemo(() => {
    let belumLunas = 0
    let lunas = 0
    let jumlahBelumLunas = 0
    for (const r of rows) {
      const amount = parseNum(r.amount)
      if (r.settledAt) lunas += amount
      else {
        belumLunas += amount
        jumlahBelumLunas += 1
      }
    }
    return { belumLunas, lunas, jumlahBelumLunas, all: belumLunas + lunas }
  }, [rows])

  const companyName = companies.find((c) => c.id === companyId)?.name ?? "-"

  return (
    <div className="flex flex-col gap-4">
      {/* ── Kontrol ─────────────────────────────────────────────────────── */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4 shadow-sm">
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">Tanggal</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-44"
          />
        </div>
        {canSelectCompany ? (
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Pilih PT</label>
            <Select value={companyId} onValueChange={selectCompany}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Pilih PT" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          companies.length > 0 && (
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs font-medium">PT</label>
              <div className="bg-muted/40 flex h-9 items-center rounded-md border px-3 text-sm font-medium">
                {companyName}
              </div>
            </div>
          )
        )}
        <div className="ml-auto flex items-center gap-2">
          {!canManage && <Badge variant="soft">Read-only</Badge>}
          {isPast && canManage && !canBackdate && (
            <Badge variant="warning">Isi terkunci — tanggal lampau</Badge>
          )}
          {companyId && (
            <Button size="sm" disabled={!canEditContent} onClick={() => setAddOpen(true)}>
              <IconPlus className="size-4" />
              Tambah Dana Tertahan
            </Button>
          )}
        </div>
      </div>

      {!companyId && (
        <SectionCard padded={false}>
          <EmptyState
            title="Pilih PT terlebih dahulu"
            description="Catatan dana tertahan akan muncul setelah PT dan tanggal dipilih."
          />
        </SectionCard>
      )}

      {companyId && (
        <>
          {/* ── Posisi ────────────────────────────────────────────────────── */}
          <MetricRow columns={3}>
            <MetricBlock
              size="hero"
              label="Dana Tertahan"
              prefix="Rp"
              tone={outstanding.total > 0 ? "warning" : "muted"}
              value={fmt(outstanding.total)}
              meta={`${fmt(outstanding.count)} catatan belum lunas · seluruh tanggal · ${companyName}`}
            />
            <MetricBlock
              size="secondary"
              label="Belum Lunas Tanggal Ini"
              prefix="Rp"
              tone={totals.belumLunas > 0 ? "warning" : "muted"}
              value={fmt(totals.belumLunas)}
              meta={`${fmt(totals.jumlahBelumLunas)} dari ${fmt(rows.length)} catatan`}
            />
            <MetricBlock
              size="secondary"
              label="Sudah Lunas Tanggal Ini"
              prefix="Rp"
              tone={totals.lunas > 0 ? "success" : "muted"}
              value={fmt(totals.lunas)}
              meta="Dicatat tanggal ini dan sudah dibayar"
            />
          </MetricRow>

          {/* ── Tabel ────────────────────────────────────────────────────── */}
          {fetching && rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Memuat data...</p>
          ) : rows.length === 0 ? (
            <SectionCard padded={false}>
              <EmptyState
                icon={<IconClockDollar className="size-5" />}
                title="Tidak ada dana tertahan pada tanggal ini"
                description={
                  canEditContent
                    ? "Kosong memang kondisi normal. Tambahkan hanya kalau ada uang yang belum masuk."
                    : "Tanggal ini tidak punya catatan hutang."
                }
                action={
                  canEditContent ? (
                    <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                      <IconPlus className="size-4" />
                      Tambah Dana Tertahan
                    </Button>
                  ) : undefined
                }
              />
            </SectionCard>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-background sticky top-0 z-20">Nama</TableHead>
                    <TableHead className="bg-background sticky top-0 z-20 w-52 text-right">
                      Jumlah (IDR)
                    </TableHead>
                    <TableHead className="bg-background sticky top-0 z-20 w-32">Status</TableHead>
                    <TableHead className="bg-background sticky top-0 z-20 w-48">Aksi</TableHead>
                    <TableHead className="bg-background sticky top-0 z-20 w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <HeldFundRow
                      key={row.id}
                      row={row}
                      rowIndex={i}
                      canEditContent={canEditContent}
                      canSettle={canSettle}
                      onDraft={updateDraft}
                      onBlurSave={saveRow}
                      onSettle={setSettled}
                      onDelete={removeRow}
                      registerCell={registerCell}
                      onCellKeyDown={handleCellKeyDown}
                    />
                  ))}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell className="text-right">Total tanggal ini</TableCell>
                    <TableCell className="tabular text-right">Rp {fmt(totals.all)}</TableCell>
                    <TableCell colSpan={3} className="text-muted-foreground text-xs">
                      Belum lunas Rp {fmt(totals.belumLunas)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
            Jumlah tersimpan otomatis saat kolomnya kehilangan fokus — tidak ada tombol simpan.
            Menandai lunas <strong className="font-medium">tidak menghapus</strong> catatannya, jadi
            riwayat &ldquo;pernah tertahan&rdquo; tetap terbaca di Laporan Finance. Angka
            &ldquo;Dana Tertahan&rdquo; di atas menjumlahkan seluruh tanggal yang belum lunas, bukan
            hanya tanggal yang sedang dibuka.
          </p>
        </>
      )}

      <AddHeldFundDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        date={date}
        onSubmit={addRow}
      />
    </div>
  )
}

/* ── Satu baris ───────────────────────────────────────────────────────────── */

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <IconLoader2 className="text-muted-foreground size-4 animate-spin" />
  if (state === "saved") return <IconCheck className="text-success size-4" />
  if (state === "error") return <IconAlertTriangle className="text-destructive size-4" />
  return <IconMinus className="text-muted-foreground/30 size-4" />
}

function HeldFundRow({
  row,
  rowIndex,
  canEditContent,
  canSettle,
  onDraft,
  onBlurSave,
  onSettle,
  onDelete,
  registerCell,
  onCellKeyDown,
}: {
  row: Row
  rowIndex: number
  canEditContent: boolean
  canSettle: boolean
  onDraft: (id: string, field: "name" | "amount", val: string) => void
  onBlurSave: (row: Row) => void
  onSettle: (row: Row, settled: boolean) => void
  onDelete: (row: Row) => void
  registerCell: ReturnType<typeof useGridKeyboardNav>["registerCell"]
  onCellKeyDown: ReturnType<typeof useGridKeyboardNav>["handleCellKeyDown"]
}) {
  const settled = row.settledAt !== null
  const busy = row.saveState === "saving"

  return (
    <TableRow className={cn(settled && "bg-success-muted/40")}>
      <TableCell>
        <Input
          ref={registerCell(rowIndex, "name")}
          type="text"
          value={row.name}
          disabled={!canEditContent}
          onChange={(e) => onDraft(row.id, "name", e.target.value)}
          onBlur={() => onBlurSave(row)}
          onKeyDown={onCellKeyDown(rowIndex, "name")}
          className="w-full text-sm"
        />
      </TableCell>
      <TableCell className="text-right">
        <NumberInput
          ref={registerCell(rowIndex, "amount")}
          value={row.amount}
          disabled={!canEditContent}
          onValueChange={(val) => onDraft(row.id, "amount", val === undefined ? "" : String(val))}
          onBlur={() => onBlurSave(row)}
          onKeyDown={onCellKeyDown(rowIndex, "amount")}
          className="tabular w-full text-right"
        />
      </TableCell>
      <TableCell>
        {settled ? (
          <Badge variant="success">Lunas</Badge>
        ) : (
          <Badge variant="warning">Tertahan</Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {/* Sengaja tersedia untuk hari berjalan juga: uang bisa masuk di hari
              yang sama, dan menunggu besok untuk mencatatnya tidak masuk akal. */}
          <Button
            size="sm"
            variant={settled ? "outline" : "default"}
            disabled={!canSettle || busy}
            onClick={() => onSettle(row, !settled)}
          >
            {busy ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : settled ? (
              <IconRotate2 className="size-4" />
            ) : (
              <IconCheck className="size-4" />
            )}
            {settled ? "Batalkan" : "Lunas"}
          </Button>
          {canEditContent && (
            <Button
              size="icon"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => onDelete(row)}
              aria-label="Hapus catatan"
            >
              <IconTrash className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <SaveIndicator state={row.saveState} />
      </TableCell>
    </TableRow>
  )
}

/* ── Pop-up tambah ────────────────────────────────────────────────────────── */

/**
 * Sengaja hanya menanyakan **nama**. Jumlahnya diisi di grid supaya alur
 * pengisiannya sama dengan halaman harian lain: satu kolom angka, simpan saat
 * kehilangan fokus, tanpa tombol simpan.
 */
function AddHeldFundDialog({
  open,
  onOpenChange,
  date,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  onSubmit: (name: string) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Nama wajib diisi")
      return
    }
    setSaving(true)
    try {
      await onSubmit(trimmed)
      toast.success("Dana tertahan ditambahkan — isi jumlahnya di tabel")
      setName("")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setName("")
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tambah Dana Tertahan</DialogTitle>
          <DialogDescription>
            Nama pihak yang uangnya belum masuk, untuk tanggal {date}. Jumlahnya diisi langsung di
            tabel.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Nama, mis. Pak Budi"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlus className="size-4" />}
            Tambah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
