"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IconAlertTriangle, IconCheck, IconLoader2, IconMinus } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useGridKeyboardNav } from "@/hooks/use-grid-keyboard-nav"
import {
  DailyVerifyCell,
  type DailyVerifyStatus,
  type PendingCorrection,
  type ApprovedCorrection,
} from "@/components/admin/stockist/daily-verify-cell"

type Account = {
  id: string
  bankName: string
  accountNumber: string | null
  accountName: string
  currencyCode: string
  referenceBalance: string
  sortOrder: number
}

type SaveState = "idle" | "saving" | "saved" | "error"

type Row = {
  bankAccountId: string
  bankName: string
  accountName: string
  currencyCode: string
  previousBalance: number | null
  previousDate: string | null
  fallbackBalance: number
  balance: string
  note: string
  savedBalance: string
  savedNote: string
  saveState: SaveState
  hasEntry: boolean
  verifyStatus: DailyVerifyStatus
  verifyNote: string | null
  pendingCorrection?: PendingCorrection
  approvedCorrection?: ApprovedCorrection
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 })
}

function parseNum(s: string): number {
  const cleaned = s.replace(/[^\d.-]/g, "")
  return parseFloat(cleaned) || 0
}

// Bentuk payload bank harian, sama untuk yang datang dari fetch maupun yang dirender server.
type BankPayload = {
  accounts?: Account[]
  serverDate?: string | null
  entries?: Record<
    string,
    { balance: string; note: string | null; verifyStatus: DailyVerifyStatus; verifyNote: string | null }
  >
  previous?: Record<string, { balance: string; date: string }>
  pendingCorrections?: Record<string, PendingCorrection>
  approvedCorrections?: Record<string, ApprovedCorrection>
}

function buildRows(payload: BankPayload): Row[] {
  const entries = payload.entries ?? {}
  const previous = payload.previous ?? {}
  const pendingCorrections = payload.pendingCorrections ?? {}
  const approvedCorrections = payload.approvedCorrections ?? {}

  return (payload.accounts ?? []).map((acc) => {
    const entry = entries[acc.id]
    const prev = previous[acc.id]
    const balance = entry?.balance ?? "0"
    const note = entry?.note ?? ""
    return {
      bankAccountId: acc.id,
      bankName: acc.bankName,
      accountName: acc.accountName,
      currencyCode: acc.currencyCode,
      previousBalance: prev ? Number(prev.balance) : null,
      previousDate: prev?.date ?? null,
      fallbackBalance: Number(acc.referenceBalance ?? 0),
      balance,
      note,
      savedBalance: balance,
      savedNote: note,
      saveState: "idle",
      hasEntry: Boolean(entry),
      verifyStatus: entry?.verifyStatus ?? "BELUM_REVIEW",
      verifyNote: entry?.verifyNote ?? null,
      pendingCorrection: pendingCorrections[acc.id],
      approvedCorrection: approvedCorrections[acc.id],
    }
  })
}

interface Props {
  companyId: string
  date: string
  canManage: boolean
  /** Koreksi pada PT ini langsung berlaku, tanpa antre Persetujuan Koreksi. */
  canDirectCorrect?: boolean
  onUnfilledChange?: (count: number) => void
  /** Payload yang sudah dirender server (bentuknya identik dengan respons /api/bank-harian). */
  initialGrid?: unknown
  /** `${companyId}:${YYYY-MM-DD}` milik initialGrid — dipakai hanya kalau cocok. */
  initialGridKey?: string | null
}

// Grid bank hanya punya satu arah navigasi (atas/bawah) — antar kolom cukup pakai Tab.
const NAV_COLUMNS = ["balance", "note"] as const
const NAV_SELECT_ON_FOCUS = ["balance"] as const

export function BankGridClient({
  companyId,
  date,
  canManage,
  canDirectCorrect = false,
  onUnfilledChange,
  initialGrid,
  initialGridKey,
}: Props) {
  // Payload server hanya sah untuk kombinasi PT + tanggal saat halaman dirender. Dihitung
  // sekali lewat lazy initializer dan tidak pernah berubah — begitu user ganti PT/tanggal,
  // data selalu datang dari fetch.
  const [seed] = useState<BankPayload | null>(() =>
    initialGrid && initialGridKey && initialGridKey === `${companyId}:${date}`
      ? (initialGrid as BankPayload)
      : null
  )

  const [rows, setRows] = useState<Row[]>(() => (seed ? buildRows(seed) : []))
  const [serverDate, setServerDate] = useState<string | null>(() => seed?.serverDate ?? null)
  const [fetching, setFetching] = useState(false)
  const rowsRef = useRef<Row[]>([])
  rowsRef.current = rows
  const { registerCell, handleCellKeyDown } = useGridKeyboardNav({
    columns: NAV_COLUMNS,
    rowCount: rows.length,
    selectOnFocus: NAV_SELECT_ON_FOCUS,
  })

  const loadData = useCallback(async () => {
    if (!companyId || !date) return
    setFetching(true)
    try {
      const res = await fetch(`/api/bank-harian?companyId=${companyId}&date=${date}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || data.message || "Gagal memuat data")
        setRows([])
        return
      }

      const payload = data.data as BankPayload
      setServerDate(payload.serverDate ?? null)
      setRows(buildRows(payload))
    } catch {
      toast.error("Gagal memuat data")
      setRows([])
    } finally {
      setFetching(false)
    }
  }, [companyId, date])

  // Kalau grid awal sudah datang bersama HTML, lewati fetch pertama — data yang sama persis.
  const skipFirstLoadRef = useRef(seed !== null)
  useEffect(() => {
    if (skipFirstLoadRef.current) {
      skipFirstLoadRef.current = false
      return
    }
    loadData()
  }, [loadData])

  const updateRow = (id: string, field: "balance" | "note", val: string) => {
    setRows((prev) => prev.map((r) => (r.bankAccountId === id ? { ...r, [field]: val } : r)))
  }

  const saveRow = async (id: string) => {
    const row = rowsRef.current.find((r) => r.bankAccountId === id)
    if (!row || !canManage) return
    if (row.balance === row.savedBalance && row.note === row.savedNote) return

    setRows((prev) =>
      prev.map((r) => (r.bankAccountId === id ? { ...r, saveState: "saving" } : r))
    )

    try {
      const res = await fetch("/api/bank-harian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          date,
          entries: [
            {
              bankAccountId: id,
              balance: parseNum(row.balance),
              note: row.note || null,
            },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Gagal menyimpan")
      }
      setRows((prev) =>
        prev.map((r) =>
          r.bankAccountId === id
            ? { ...r, savedBalance: r.balance, savedNote: r.note, saveState: "saved", hasEntry: true }
            : r
        )
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      setRows((prev) =>
        prev.map((r) => (r.bankAccountId === id ? { ...r, saveState: "error" } : r))
      )
    }
  }

  // Tanggal lampau = mode verifikasi H+1: saldonya dikunci dan hanya bisa diubah lewat
  // pengajuan koreksi yang disetujui Owner/Super Admin.
  const isPast = serverDate !== null && date < serverDate

  const verifyRow = async (
    bankAccountId: string,
    status: "BENAR" | "BEDA",
    note?: string,
    correctedBalance?: number
  ) => {
    try {
      const res = await fetch("/api/bank-harian/verify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId, date, status, note, correctedBalance }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
      toast.success(data.message ?? "Verifikasi tersimpan")
      // `applied` = koreksi langsung berlaku (izin correction.direct): saldonya sudah
      // berubah di server dan statusnya jadi "Sesuai", jadi barisnya ikut diperbarui —
      // bukan diberi badge "menunggu persetujuan".
      const applied = data.data?.applied === true && correctedBalance !== undefined
      setRows((prev) =>
        prev.map((r) => {
          if (r.bankAccountId !== bankAccountId) return r
          if (applied) {
            const next = String(correctedBalance)
            return {
              ...r,
              balance: next,
              savedBalance: next,
              verifyStatus: "BENAR",
              verifyNote: note ?? null,
              pendingCorrection: undefined,
              approvedCorrection: {
                id: "",
                currentValue: r.savedBalance,
                proposedValue: next,
                reason: note ?? "",
              },
            }
          }
          return {
            ...r,
            verifyStatus: status,
            verifyNote: note ?? null,
            pendingCorrection: data.data?.correctionRequestId
              ? {
                  id: data.data.correctionRequestId,
                  proposedValue: String(correctedBalance ?? ""),
                  reason: note ?? "",
                }
              : undefined,
          }
        })
      )
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      return false
    }
  }

  const totals = useMemo(() => {
    let totalBalance = 0
    let totalDelta = 0
    let unfilled = 0
    let belumVerifikasi = 0
    for (const r of rows) {
      const balance = parseNum(r.balance)
      const ref = r.previousBalance ?? r.fallbackBalance
      totalBalance += balance
      totalDelta += balance - ref
      if (!r.hasEntry) unfilled += 1
      if (r.hasEntry && r.verifyStatus === "BELUM_REVIEW" && !r.pendingCorrection) {
        belumVerifikasi += 1
      }
    }
    return { totalBalance, totalDelta, unfilled, belumVerifikasi }
  }, [rows])

  const onUnfilledChangeRef = useRef(onUnfilledChange)
  onUnfilledChangeRef.current = onUnfilledChange
  useEffect(() => {
    onUnfilledChangeRef.current?.(totals.unfilled)
  }, [totals.unfilled])

  if (fetching && rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Memuat data...</p>
  }

  if (!fetching && rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada rekening bank aktif untuk PT ini.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isPast ? (
          totals.belumVerifikasi > 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-warning">
              <IconAlertTriangle className="size-4" />
              {totals.belumVerifikasi} rekening belum dikonfirmasi untuk tanggal ini.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Semua saldo tanggal ini sudah dikonfirmasi.
            </p>
          )
        ) : totals.unfilled > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-warning">
            <IconAlertTriangle className="size-4" />
            {totals.unfilled} rekening belum diisi hari ini.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Semua rekening sudah diisi hari ini.</p>
        )}
      </div>

      <div className="rounded-md border max-h-[65vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky top-0 z-20 bg-background">Rekening PT</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background">Bank</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background w-40 text-right">Saldo Kemarin</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background w-52 text-right">
                {isPast ? "Saldo Tanggal Ini" : "Saldo Hari Ini"}
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-background w-36 text-right">Delta</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background w-44">Catatan</TableHead>
              {isPast && (
                <TableHead className="sticky top-0 z-20 bg-background w-56">Konfirmasi</TableHead>
              )}
              <TableHead className="sticky top-0 z-20 bg-background w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <BankRowEdit
                key={r.bankAccountId}
                row={r}
                canManage={canManage}
                canDirectCorrect={canDirectCorrect}
                isPast={isPast}
                onChange={updateRow}
                onBlurSave={saveRow}
                onVerify={verifyRow}
                registerCell={registerCell}
                onCellKeyDown={handleCellKeyDown}
                rowIndex={i}
              />
            ))}
            <TableRow className="font-medium bg-muted/50">
              <TableCell colSpan={3} className="text-right">
                Total
              </TableCell>
              <TableCell className="text-right font-mono">Rp {fmt(totals.totalBalance)}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono",
                  totals.totalDelta > 0 && "text-success",
                  totals.totalDelta < 0 && "text-destructive"
                )}
              >
                {totals.totalDelta > 0 ? "+" : ""}
                {fmt(totals.totalDelta)}
              </TableCell>
              <TableCell colSpan={isPast ? 3 : 2} />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
  if (state === "saved") return <IconCheck className="size-4 text-success" />
  if (state === "error") return <IconAlertTriangle className="size-4 text-destructive" />
  return <IconMinus className="size-4 text-muted-foreground/30" />
}

function BankRowEdit({
  row,
  canManage,
  canDirectCorrect,
  isPast,
  onChange,
  onBlurSave,
  onVerify,
  registerCell,
  onCellKeyDown,
  rowIndex,
}: {
  row: Row
  canManage: boolean
  canDirectCorrect: boolean
  isPast: boolean
  onChange: (id: string, field: "balance" | "note", val: string) => void
  onBlurSave: (id: string) => void
  onVerify: (
    id: string,
    status: "BENAR" | "BEDA",
    note?: string,
    correctedBalance?: number
  ) => Promise<boolean>
  registerCell: ReturnType<typeof useGridKeyboardNav>["registerCell"]
  onCellKeyDown: ReturnType<typeof useGridKeyboardNav>["handleCellKeyDown"]
  rowIndex: number
}) {
  const balance = parseNum(row.balance)
  const reference = row.previousBalance ?? row.fallbackBalance
  const delta = balance - reference
  const isUnfilled = !row.hasEntry
  // Saldo tanggal lampau dikunci — perubahannya wajib lewat pengajuan koreksi.
  const editable = canManage && !isPast

  return (
    <TableRow
      className={cn(
        isUnfilled && "bg-warning-muted/60",
        !isUnfilled && row.approvedCorrection && "bg-destructive/8"
      )}
    >
      <TableCell className="font-medium text-sm">
        <span
          className={cn(
            "inline-block size-1.5 rounded-full mr-1.5 align-middle",
            isUnfilled ? "bg-warning" : "bg-success"
          )}
        />
        {row.accountName}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{row.bankName}</Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        Rp {fmt(reference)}
        {!row.previousBalance && (
          <div className="text-[10px] text-muted-foreground/60">(saldo referensi)</div>
        )}
      </TableCell>
      <TableCell className="text-right">
        {/* Saldo bank boleh MINUS. Rekening bisa overdraft atau berupa fasilitas
            kredit, jadi "bank hutang" adalah keadaan nyata yang harus bisa
            diinput — bukan salah ketik yang perlu dicegah. Berbeda dari grid
            stock & kas, yang menghitung barang dan uang tunai di tangan dan
            karenanya tidak bisa kurang dari nol. */}
        <NumberInput
          ref={registerCell(rowIndex, "balance")}
          value={row.balance}
          allowNegative
          disabled={!editable}
          onValueChange={(val) => onChange(row.bankAccountId, "balance", val === undefined ? "" : String(val))}
          onBlur={() => onBlurSave(row.bankAccountId)}
          onKeyDown={onCellKeyDown(rowIndex, "balance")}
          className="text-right font-mono w-full"
        />
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono text-sm",
          delta > 0 && "text-success",
          delta < 0 && "text-destructive"
        )}
      >
        {delta > 0 ? "+" : ""}
        {fmt(delta)}
      </TableCell>
      <TableCell>
        <Input
          ref={registerCell(rowIndex, "note")}
          type="text"
          value={row.note}
          disabled={!editable}
          placeholder="Opsional"
          onChange={(e) => onChange(row.bankAccountId, "note", e.target.value)}
          onBlur={() => onBlurSave(row.bankAccountId)}
          onKeyDown={onCellKeyDown(rowIndex, "note")}
          className="w-full text-sm"
        />
      </TableCell>
      {isPast && (
        <TableCell>
          {row.hasEntry ? (
            <DailyVerifyCell
              status={row.verifyStatus}
              note={row.verifyNote}
              balance={balance}
              pending={row.pendingCorrection}
              approved={row.approvedCorrection}
              canVerify={canManage}
              canDirectCorrect={canDirectCorrect}
              // Koreksi saldo bank juga boleh minus — kalau tidak, sel yang salah
              // dicatat positif mustahil dibetulkan ke keadaan overdraft.
              allowNegative
              onVerify={(status, note, correctedBalance) =>
                onVerify(row.bankAccountId, status, note, correctedBalance)
              }
            />
          ) : (
            <span className="text-xs text-muted-foreground">Tidak diisi</span>
          )}
        </TableCell>
      )}
      <TableCell>
        <SaveIndicator state={row.saveState} />
      </TableCell>
    </TableRow>
  )
}
