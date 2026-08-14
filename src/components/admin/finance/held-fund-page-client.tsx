"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Combobox } from "@/components/ui/combobox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  IconArrowDownLeft,
  IconArrowUpRight,
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

/**
 * Arah hutang, dari sisi perusahaan. Dua-duanya kewajiban yang belum selesai,
 * tapi uangnya bergerak ke arah yang berlawanan — karena itu tidak pernah
 * dijumlahkan jadi satu angka bersih di mana pun di halaman ini.
 */
type Kind = "CREDIT" | "DEBIT"

/** Baris apa adanya dari server. */
type ServerRow = {
  id: string
  date: string
  kind: Kind
  name: string
  amount: string
  note: string | null
  settledAt: string | null
  createdByName: string | null
  settledByName: string | null
}

type Outstanding = {
  total: number
  count: number
  credit: { total: number; count: number }
  debit: { total: number; count: number }
}

type Payload = {
  serverDate?: string | null
  rows?: ServerRow[]
  outstandingRows?: ServerRow[]
  outstanding?: Outstanding
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

const EMPTY_OUTSTANDING: Outstanding = {
  total: 0,
  count: 0,
  credit: { total: 0, count: 0 },
  debit: { total: 0, count: 0 },
}

/** Satu tempat penamaan arah, supaya label di badge, dialog, dan toast tidak berbeda kata. */
const KIND_META: Record<Kind, { label: string; long: string; badge: "info" | "danger" }> = {
  CREDIT: {
    label: "Credit",
    long: "Credit — orang berhutang ke perusahaan (uang akan masuk)",
    badge: "info",
  },
  DEBIT: {
    label: "Debit",
    long: "Debit — perusahaan berhutang ke orang (uang akan keluar)",
    badge: "danger",
  },
}

const kindKey = (kind: Kind): "credit" | "debit" => (kind === "DEBIT" ? "debit" : "credit")

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 })
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
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
 * Dana Tertahan: uang yang tertahan di kedua arah, dicatat per tanggal.
 *
 * Halaman ini punya dua tampilan yang menjawab dua pertanyaan berbeda, dan
 * keduanya perlu ada:
 *
 * • **Belum Lunas** — daftar SELURUH hutang yang masih menggantung, credit &
 *   debit, lintas tanggal. Inilah tampilan bawaan: yang perlu ditindak adalah
 *   hutang yang belum selesai, bukan hutang yang kebetulan dicatat hari ini.
 * • **Input Tanggal** — grid pengisian untuk satu tanggal, termasuk yang sudah
 *   lunas, dengan alur ketik-lalu-blur seperti halaman harian lain.
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
  const [outstandingRows, setOutstandingRows] = useState<Row[]>(() =>
    (seed?.outstandingRows ?? []).map(toRow)
  )
  const [outstanding, setOutstanding] = useState<Outstanding>(
    () => seed?.outstanding ?? EMPTY_OUTSTANDING
  )
  const [serverDate, setServerDate] = useState<string | null>(() => seed?.serverDate ?? null)
  const [fetching, setFetching] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [kindFilter, setKindFilter] = useState<Kind | "ALL">("ALL")

  /**
   * Pelunasan tidak pernah langsung dieksekusi dari klik tombol. Baris yang
   * ditunjuk disimpan di sini dulu supaya dialog konfirmasi bisa menyebut nama,
   * arah, dan angkanya — "Lunas" berarti uangnya dianggap sudah berpindah, dan
   * salah klik pada baris tetangga menghapus tagihan yang masih hidup dari
   * daftar tanpa jejak yang terlihat di layar.
   */
  const [confirm, setConfirm] = useState<{ row: Row; settled: boolean } | null>(null)
  const [confirming, setConfirming] = useState(false)

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
        setOutstandingRows([])
        return
      }
      const payload = data.data as Payload
      setServerDate(payload.serverDate ?? null)
      setRows((payload.rows ?? []).map(toRow))
      setOutstandingRows((payload.outstandingRows ?? []).map(toRow))
      setOutstanding(payload.outstanding ?? EMPTY_OUTSTANDING)
    } catch {
      toast.error("Gagal memuat data")
      setRows([])
      setOutstandingRows([])
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
  // baris itu sudah ada di tangan pemanggilnya. Menyimpan salinan `rows` di ref
  // hanya untuk dicari ulang berarti membaca ref saat render — dilarang lint
  // `react-hooks/purity`, dan memang tidak perlu di sini.

  /**
   * Satu baris bisa hadir di DUA daftar sekaligus: grid tanggal yang sedang
   * dibuka dan daftar belum-lunas lintas tanggal. Setiap perubahan karena itu
   * selalu dikenakan ke keduanya — kalau tidak, mengubah angka di satu tab akan
   * menyisakan angka lama di tab sebelah sampai halaman dimuat ulang.
   */
  const patchRow = (id: string, patch: Partial<Row>) => {
    const apply = (prev: Row[]) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    setRows(apply)
    setOutstandingRows(apply)
  }

  const updateDraft = (id: string, field: "name" | "amount", val: string) =>
    patchRow(id, { [field]: val } as Partial<Row>)

  /** Menggeser posisi tertahan seketika, per arah — tanpa ini angka besar di atas baru benar setelah reload. */
  const shiftOutstanding = (kind: Kind, deltaTotal: number, deltaCount: number) =>
    setOutstanding((o) => {
      const bucket = { total: o[kindKey(kind)].total + deltaTotal, count: o[kindKey(kind)].count + deltaCount }
      return {
        total: o.total + deltaTotal,
        count: o.count + deltaCount,
        credit: kind === "CREDIT" ? bucket : o.credit,
        debit: kind === "DEBIT" ? bucket : o.debit,
      }
    })

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
      if (!row.settledAt && delta !== 0) shiftOutstanding(row.kind, delta, 0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      patchRow(row.id, { saveState: "error" })
    }
  }

  const addRow = async (kind: Kind, name: string, amount: number) => {
    const res = await fetch("/api/dana-tertahan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, date, kind, name, amount }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menambah")

    const created = toRow(data.data as ServerRow)
    setRows((prev) => [...prev, created])
    // Baris baru selalu belum lunas, jadi ia juga anggota daftar belum-lunas.
    setOutstandingRows((prev) => [...prev, created])
    // Angka yang digeser diambil dari BALASAN server (`created`), bukan dari
    // input dialog: kalau server sempat membulatkan atau menolak sebagian nilai,
    // posisi tertahan di layar tetap sama dengan yang tersimpan.
    shiftOutstanding(kind, parseNum(created.savedAmount), 1)
  }

  /** Eksekusi pelunasan — hanya dipanggil dari dialog konfirmasi, tidak dari tombol baris. */
  const runSettle = async (row: Row, settled: boolean) => {
    setConfirming(true)
    patchRow(row.id, { saveState: "saving" })
    try {
      const res = await fetch(`/api/dana-tertahan/${row.id}/lunas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settled }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")

      const updated = data.data as ServerRow
      // Angka yang dipakai adalah yang SUDAH tersimpan, bukan draft yang sedang
      // diketik — kalau tidak, posisi tertahan bergeser memakai angka yang belum
      // pernah sampai ke server.
      const amount = parseNum(row.savedAmount)
      patchRow(row.id, {
        settledAt: updated.settledAt,
        settledByName: updated.settledByName,
        saveState: "idle",
      })
      // Daftar belum-lunas hanya memuat yang belum lunas: baris yang baru saja
      // dilunasi keluar dari sana, dan yang dibatalkan kembali masuk.
      setOutstandingRows((prev) =>
        settled
          ? prev.filter((r) => r.id !== row.id)
          : prev.some((r) => r.id === row.id)
            ? prev
            : [...prev, { ...row, settledAt: null, settledByName: null, saveState: "idle" }]
      )
      shiftOutstanding(row.kind, settled ? -amount : amount, settled ? -1 : 1)
      toast.success(data.message ?? (settled ? "Ditandai lunas" : "Ditandai belum lunas"))
      setConfirm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      patchRow(row.id, { saveState: "error" })
    } finally {
      setConfirming(false)
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
      setOutstandingRows((prev) => prev.filter((r) => r.id !== row.id))
      if (!row.settledAt) shiftOutstanding(row.kind, -parseNum(row.savedAmount), -1)
      toast.success("Catatan dihapus")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
      patchRow(row.id, { saveState: "error" })
    }
  }

  /* ── Turunan ────────────────────────────────────────────────────────────── */

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

  const visibleOutstanding = useMemo(
    () => (kindFilter === "ALL" ? outstandingRows : outstandingRows.filter((r) => r.kind === kindFilter)),
    [outstandingRows, kindFilter]
  )

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
            <Combobox
              value={companyId}
              onValueChange={selectCompany}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Pilih PT"
              searchPlaceholder="Cari PT..."
              className="w-52"
            />
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
              label="Credit — Akan Masuk"
              prefix="Rp"
              tone={outstanding.credit.total > 0 ? "warning" : "muted"}
              value={fmt(outstanding.credit.total)}
              meta={`${fmt(outstanding.credit.count)} catatan belum lunas · seluruh tanggal · ${companyName}`}
            />
            <MetricBlock
              size="hero"
              label="Debit — Akan Keluar"
              prefix="Rp"
              tone={outstanding.debit.total > 0 ? "destructive" : "muted"}
              value={fmt(outstanding.debit.total)}
              meta={`${fmt(outstanding.debit.count)} catatan belum lunas · seluruh tanggal · ${companyName}`}
            />
            <MetricBlock
              size="secondary"
              label="Belum Lunas Tanggal Ini"
              prefix="Rp"
              tone={totals.belumLunas > 0 ? "warning" : "muted"}
              value={fmt(totals.belumLunas)}
              meta={`${fmt(totals.jumlahBelumLunas)} dari ${fmt(rows.length)} catatan tanggal ${fmtDate(date)}`}
            />
          </MetricRow>

          <Tabs defaultValue="outstanding" className="gap-4">
            <TabsList>
              <TabsTrigger value="outstanding">
                Belum Lunas ({fmt(outstandingRows.length)})
              </TabsTrigger>
              <TabsTrigger value="input">Input Tanggal {fmtDate(date)}</TabsTrigger>
            </TabsList>

            {/* ── Daftar semua yang belum lunas ─────────────────────────── */}
            <TabsContent value="outstanding" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(["ALL", "CREDIT", "DEBIT"] as const).map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={kindFilter === k ? "default" : "outline"}
                    onClick={() => setKindFilter(k)}
                  >
                    {k === "ALL" ? "Semua" : KIND_META[k].label}
                  </Button>
                ))}
                <span className="text-muted-foreground ml-2 text-xs">
                  Menampilkan seluruh tanggal, bukan hanya {fmtDate(date)}.
                </span>
              </div>

              {fetching && outstandingRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">Memuat data...</p>
              ) : visibleOutstanding.length === 0 ? (
                <SectionCard padded={false}>
                  <EmptyState
                    icon={<IconCheck className="size-5" />}
                    title="Tidak ada dana tertahan yang menggantung"
                    description={
                      kindFilter === "ALL"
                        ? "Semua hutang credit maupun debit sudah dinyatakan lunas."
                        : `Tidak ada hutang ${KIND_META[kindFilter].label.toLowerCase()} yang belum lunas.`
                    }
                  />
                </SectionCard>
              ) : (
                <div className="max-h-[65vh] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="bg-background sticky top-0 z-20 w-28">Tanggal</TableHead>
                        <TableHead className="bg-background sticky top-0 z-20 w-28">Jenis</TableHead>
                        <TableHead className="bg-background sticky top-0 z-20">Nama</TableHead>
                        <TableHead className="bg-background sticky top-0 z-20 w-44 text-right">
                          Jumlah (IDR)
                        </TableHead>
                        <TableHead className="bg-background sticky top-0 z-20 w-40">
                          Dicatat oleh
                        </TableHead>
                        <TableHead className="bg-background sticky top-0 z-20 w-32">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleOutstanding.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="tabular text-sm">{fmtDate(row.date)}</TableCell>
                          <TableCell>
                            <KindBadge kind={row.kind} />
                          </TableCell>
                          <TableCell className="text-sm font-medium">{row.savedName}</TableCell>
                          <TableCell className="tabular text-right text-sm">
                            Rp {fmt(parseNum(row.savedAmount))}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.createdByName ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              disabled={!canSettle || row.saveState === "saving"}
                              onClick={() => setConfirm({ row, settled: true })}
                            >
                              {row.saveState === "saving" ? (
                                <IconLoader2 className="size-4 animate-spin" />
                              ) : (
                                <IconCheck className="size-4" />
                              )}
                              Lunas
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell colSpan={3} className="text-right">
                          Total belum lunas
                          {kindFilter !== "ALL" && ` — ${KIND_META[kindFilter].label}`}
                        </TableCell>
                        <TableCell className="tabular text-right">
                          Rp{" "}
                          {fmt(
                            visibleOutstanding.reduce((sum, r) => sum + parseNum(r.savedAmount), 0)
                          )}
                        </TableCell>
                        <TableCell colSpan={2} className="text-muted-foreground text-xs">
                          {fmt(visibleOutstanding.length)} catatan
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ── Grid input satu tanggal ───────────────────────────────── */}
            <TabsContent value="input" className="flex flex-col gap-3">
              {fetching && rows.length === 0 ? (
                <p className="text-muted-foreground text-sm">Memuat data...</p>
              ) : rows.length === 0 ? (
                <SectionCard padded={false}>
                  <EmptyState
                    icon={<IconClockDollar className="size-5" />}
                    title="Tidak ada dana tertahan pada tanggal ini"
                    description={
                      canEditContent
                        ? "Kosong memang kondisi normal. Tambahkan hanya kalau ada uang yang belum masuk atau belum keluar."
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
                        <TableHead className="bg-background sticky top-0 z-20 w-28">Jenis</TableHead>
                        <TableHead className="bg-background sticky top-0 z-20">Nama</TableHead>
                        <TableHead className="bg-background sticky top-0 z-20 w-52 text-right">
                          Jumlah (IDR)
                        </TableHead>
                        <TableHead className="bg-background sticky top-0 z-20 w-36">
                          Dicatat oleh
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
                          onAskSettle={(r, settled) => setConfirm({ row: r, settled })}
                          onDelete={removeRow}
                          registerCell={registerCell}
                          onCellKeyDown={handleCellKeyDown}
                        />
                      ))}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell colSpan={2} className="text-right">
                          Total tanggal ini
                        </TableCell>
                        <TableCell className="tabular text-right">Rp {fmt(totals.all)}</TableCell>
                        <TableCell colSpan={4} className="text-muted-foreground text-xs">
                          Belum lunas Rp {fmt(totals.belumLunas)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
            <strong className="font-medium">Credit</strong> = orang berhutang ke perusahaan (uang
            akan masuk). <strong className="font-medium">Debit</strong> = perusahaan yang harus
            membayar (uang akan keluar). Keduanya tidak pernah dijumlahkan jadi satu angka bersih.
            Jumlah tersimpan otomatis saat kolomnya kehilangan fokus — tidak ada tombol simpan.
            Menandai lunas <strong className="font-medium">tidak menghapus</strong> catatannya, jadi
            riwayat &ldquo;pernah tertahan&rdquo; tetap terbaca di Laporan Finance.
          </p>
        </>
      )}

      <AddHeldFundDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        date={date}
        onSubmit={addRow}
      />

      <SettleConfirmDialog
        target={confirm}
        busy={confirming}
        onCancel={() => setConfirm(null)}
        onConfirm={runSettle}
      />
    </div>
  )
}

/* ── Potongan kecil ───────────────────────────────────────────────────────── */

function KindBadge({ kind }: { kind: Kind }) {
  const meta = KIND_META[kind]
  return (
    <Badge variant={meta.badge} title={meta.long}>
      {kind === "CREDIT" ? (
        <IconArrowDownLeft className="size-3.5" />
      ) : (
        <IconArrowUpRight className="size-3.5" />
      )}
      {meta.label}
    </Badge>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <IconLoader2 className="text-muted-foreground size-4 animate-spin" />
  if (state === "saved") return <IconCheck className="text-success size-4" />
  if (state === "error") return <IconAlertTriangle className="text-destructive size-4" />
  return <IconMinus className="text-muted-foreground/30 size-4" />
}

/**
 * Lapisan konfirmasi pelunasan.
 *
 * Sengaja menyebut ulang nama, arah, tanggal, dan angkanya alih-alih bertanya
 * "yakin?": yang perlu dicek user bukan kemauannya sendiri, melainkan apakah
 * baris yang tersorot memang baris yang ia maksud. Daftar belum-lunas bisa
 * berisi puluhan nama mirip dari tanggal berbeda.
 */
function SettleConfirmDialog({
  target,
  busy,
  onCancel,
  onConfirm,
}: {
  target: { row: Row; settled: boolean } | null
  busy: boolean
  onCancel: () => void
  onConfirm: (row: Row, settled: boolean) => void
}) {
  const settled = target?.settled ?? true
  const row = target?.row
  const meta = row ? KIND_META[row.kind] : null

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        // Menutup di tengah request akan menyembunyikan hasilnya; tombolnya
        // sendiri sudah dinonaktifkan, jadi ini menutup jalur Esc / klik luar.
        if (!open && !busy) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {settled ? "Tandai lunas?" : "Batalkan status lunas?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                {settled
                  ? "Catatan ini akan keluar dari daftar dana tertahan. Riwayatnya tetap tersimpan dan terbaca di Laporan Finance."
                  : "Catatan ini akan kembali dihitung sebagai dana tertahan, dan jejak siapa yang melunasinya dihapus."}
              </p>
              {row && meta && (
                <div className="text-foreground bg-muted/40 grid gap-1 rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">Nama</span>
                    <span className="font-medium">{row.savedName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">Jenis</span>
                    <span className="font-medium">{meta.long}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">Tanggal dicatat</span>
                    <span className="tabular font-medium">{fmtDate(row.date)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">Dicatat oleh</span>
                    <span className="font-medium">{row.createdByName ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t pt-1">
                    <span className="text-muted-foreground text-xs">Jumlah</span>
                    <span className="tabular text-base font-semibold">
                      Rp {fmt(parseNum(row.savedAmount))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
          {/* Tombol biasa, bukan AlertDialogAction: aksinya asinkron dan dialog
              baru boleh tertutup setelah server menjawab, sedangkan
              AlertDialogAction selalu menutup begitu diklik. */}
          <Button disabled={busy || !row} onClick={() => row && onConfirm(row, settled)}>
            {busy ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : settled ? (
              <IconCheck className="size-4" />
            ) : (
              <IconRotate2 className="size-4" />
            )}
            {settled ? "Ya, tandai lunas" : "Ya, batalkan"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ── Satu baris grid tanggal ──────────────────────────────────────────────── */

function HeldFundRow({
  row,
  rowIndex,
  canEditContent,
  canSettle,
  onDraft,
  onBlurSave,
  onAskSettle,
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
  onAskSettle: (row: Row, settled: boolean) => void
  onDelete: (row: Row) => void
  registerCell: ReturnType<typeof useGridKeyboardNav>["registerCell"]
  onCellKeyDown: ReturnType<typeof useGridKeyboardNav>["handleCellKeyDown"]
}) {
  const settled = row.settledAt !== null
  const busy = row.saveState === "saving"

  return (
    <TableRow className={cn(settled && "bg-success-muted/40")}>
      <TableCell>
        <KindBadge kind={row.kind} />
      </TableCell>
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
      <TableCell className="text-muted-foreground text-sm">{row.createdByName ?? "—"}</TableCell>
      <TableCell>
        {settled ? (
          <Badge variant="success" title={row.settledByName ? `Dilunasi oleh ${row.settledByName}` : undefined}>
            Lunas
          </Badge>
        ) : (
          <Badge variant="warning">Tertahan</Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {/* Sengaja tersedia untuk hari berjalan juga: uang bisa masuk di hari
              yang sama, dan menunggu besok untuk mencatatnya tidak masuk akal.
              Kliknya membuka konfirmasi, bukan langsung mengeksekusi. */}
          <Button
            size="sm"
            variant={settled ? "outline" : "default"}
            disabled={!canSettle || busy}
            onClick={() => onAskSettle(row, !settled)}
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
 * Menanyakan **arah**, **nama**, dan **jumlah** sekaligus.
 *
 * Jumlahnya ikut ditanyakan di sini karena hutang tanpa angka bukan catatan yang
 * berguna: sebelum ada nominalnya, posisi tertahan di atas halaman tetap Rp 0 dan
 * tidak ada yang tahu seberapa besar kewajibannya. Angkanya tetap bisa dikoreksi
 * belakangan lewat grid Input Tanggal — yang dihilangkan hanya keharusan pindah
 * tab hanya untuk mengetik nominal yang sudah diketahui sejak awal.
 *
 * Arahnya ditanyakan di sini, bukan diubah belakangan di tabel, karena inilah
 * satu-satunya momen si pencatat benar-benar tahu uangnya akan masuk atau keluar.
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
  onSubmit: (kind: Kind, name: string, amount: number) => Promise<void>
}) {
  const [kind, setKind] = useState<Kind>("CREDIT")
  const [name, setName] = useState("")
  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setName("")
    setAmount(undefined)
    setKind("CREDIT")
  }

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Nama wajib diisi")
      return
    }
    // Nol dibiarkan lolos, kosong tidak: "belum tahu angkanya" masih kondisi yang
    // sah untuk hutang yang baru terdengar, tapi harus dinyatakan dengan sengaja
    // mengetik 0 — bukan tercipta diam-diam karena kolomnya terlewat.
    if (amount === undefined) {
      toast.error("Jumlah wajib diisi — ketik 0 kalau nominalnya belum diketahui")
      return
    }
    setSaving(true)
    try {
      await onSubmit(kind, trimmed, amount)
      toast.success(`${KIND_META[kind].label} ${trimmed} ditambahkan — Rp ${fmt(amount)}`)
      reset()
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
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Dana Tertahan</DialogTitle>
          <DialogDescription>
            Untuk tanggal {fmtDate(date)}. Nominalnya bisa dikoreksi belakangan di tab Input
            Tanggal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Jenis</label>
            <div className="grid grid-cols-2 gap-2">
              {(["CREDIT", "DEBIT"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-md border p-3 text-left text-sm transition-colors",
                    kind === k
                      ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    {k === "CREDIT" ? (
                      <IconArrowDownLeft className="size-4" />
                    ) : (
                      <IconArrowUpRight className="size-4" />
                    )}
                    {KIND_META[k].label}
                  </span>
                  <span className="text-muted-foreground text-xs leading-snug">
                    {k === "CREDIT"
                      ? "Orang berhutang — uang akan masuk"
                      : "Perusahaan berhutang — uang akan keluar"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">
              {kind === "CREDIT" ? "Nama pihak yang berhutang" : "Nama pihak yang harus dibayar"}
            </label>
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
          </div>

          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">
              {kind === "CREDIT" ? "Jumlah yang akan masuk (IDR)" : "Jumlah yang harus dibayar (IDR)"}
            </label>
            <NumberInput
              value={amount ?? ""}
              placeholder="0"
              onValueChange={setAmount}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submit()
                }
              }}
              className="tabular text-right"
            />
            <p className="text-muted-foreground text-xs leading-snug">
              {kind === "CREDIT"
                ? "Masuk ke posisi Credit — Akan Masuk begitu tersimpan."
                : "Masuk ke posisi Debit — Akan Keluar begitu tersimpan."}
            </p>
          </div>
        </div>

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
