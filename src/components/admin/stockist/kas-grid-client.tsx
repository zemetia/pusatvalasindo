"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
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
import { StockistPocketSheet } from "@/components/admin/stockist/stockist-pocket-sheet"
import {
  DailyVerifyCell,
  type DailyVerifyStatus,
  type PendingCorrection,
  type ApprovedCorrection,
} from "@/components/admin/stockist/daily-verify-cell"

type Pocket = { id: string; name: string; code: string | null; isActive: boolean }

type SaveState = "idle" | "saving" | "saved" | "error"

type Row = {
  kasPocketId: string
  name: string
  previousBalance: number | null
  previousDate: string | null
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

interface Props {
  companyId: string
  date: string
  canManage: boolean
  onUnfilledChange?: (count: number) => void
}

// Grid kas hanya punya satu arah navigasi (atas/bawah) — antar kolom cukup pakai Tab.
const NAV_COLUMNS = ["balance", "note"] as const
const NAV_SELECT_ON_FOCUS = ["balance"] as const

export function KasGridClient({ companyId, date, canManage, onUnfilledChange }: Props) {
  const [pockets, setPockets] = useState<Pocket[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [serverDate, setServerDate] = useState<string | null>(null)
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
      const res = await fetch(`/api/stockist/kas?companyId=${companyId}&date=${date}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || data.message || "Gagal memuat data")
        setPockets([])
        setRows([])
        return
      }

      const pocketList: Pocket[] = (data.data.pockets ?? []).filter((p: Pocket) => p.isActive)
      const entries: Record<
        string,
        { balance: string; note: string | null; verifyStatus: DailyVerifyStatus; verifyNote: string | null }
      > = data.data.entries ?? {}
      const previous: Record<string, { balance: string; date: string }> = data.data.previous ?? {}
      const pendingCorrections: Record<string, PendingCorrection> = data.data.pendingCorrections ?? {}
      const approvedCorrections: Record<string, ApprovedCorrection> = data.data.approvedCorrections ?? {}

      setPockets(data.data.pockets ?? [])
      setServerDate(data.data.serverDate ?? null)

      const builtRows: Row[] = pocketList.map((p) => {
        const entry = entries[p.id]
        const prev = previous[p.id]
        const balance = entry?.balance ?? "0"
        const note = entry?.note ?? ""
        return {
          kasPocketId: p.id,
          name: p.name,
          previousBalance: prev ? Number(prev.balance) : null,
          previousDate: prev?.date ?? null,
          balance,
          note,
          savedBalance: balance,
          savedNote: note,
          saveState: "idle",
          hasEntry: Boolean(entry),
          verifyStatus: entry?.verifyStatus ?? "BELUM_REVIEW",
          verifyNote: entry?.verifyNote ?? null,
          pendingCorrection: pendingCorrections[p.id],
          approvedCorrection: approvedCorrections[p.id],
        }
      })
      setRows(builtRows)
    } catch {
      toast.error("Gagal memuat data")
      setRows([])
    } finally {
      setFetching(false)
    }
  }, [companyId, date])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateRow = (id: string, field: "balance" | "note", val: string) => {
    setRows((prev) => prev.map((r) => (r.kasPocketId === id ? { ...r, [field]: val } : r)))
  }

  const saveRow = async (id: string) => {
    const row = rowsRef.current.find((r) => r.kasPocketId === id)
    if (!row || !canManage) return
    if (row.balance === row.savedBalance && row.note === row.savedNote) return

    setRows((prev) => prev.map((r) => (r.kasPocketId === id ? { ...r, saveState: "saving" } : r)))

    try {
      const res = await fetch("/api/stockist/kas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kasPocketId: id,
          date,
          balance: parseNum(row.balance),
          note: row.note || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
      setRows((prev) =>
        prev.map((r) =>
          r.kasPocketId === id
            ? { ...r, savedBalance: r.balance, savedNote: r.note, saveState: "saved", hasEntry: true }
            : r
        )
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      setRows((prev) => prev.map((r) => (r.kasPocketId === id ? { ...r, saveState: "error" } : r)))
    }
  }

  // Tanggal lampau = mode verifikasi H+1: saldonya dikunci dan hanya bisa diubah lewat
  // pengajuan koreksi yang disetujui Owner/Super Admin.
  const isPast = serverDate !== null && date < serverDate

  const verifyRow = async (
    kasPocketId: string,
    status: "BENAR" | "BEDA",
    note?: string,
    correctedBalance?: number
  ) => {
    try {
      const res = await fetch("/api/stockist/kas/verify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kasPocketId, date, status, note, correctedBalance }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
      toast.success(data.message ?? "Verifikasi tersimpan")
      setRows((prev) =>
        prev.map((r) =>
          r.kasPocketId === kasPocketId
            ? {
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
            : r
        )
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
      const ref = r.previousBalance ?? 0
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

  if (!fetching && pockets.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Belum ada pocket kas aktif untuk PT ini.</p>
        {canManage && (
          <div>
            <StockistPocketSheet kind="kas" companyId={companyId} pockets={pockets} onChanged={loadData} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isPast ? (
          totals.belumVerifikasi > 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-warning">
              <IconAlertTriangle className="size-4" />
              {totals.belumVerifikasi} pocket belum dikonfirmasi untuk tanggal ini.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Semua saldo tanggal ini sudah dikonfirmasi.
            </p>
          )
        ) : totals.unfilled > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-warning">
            <IconAlertTriangle className="size-4" />
            {totals.unfilled} pocket belum diisi hari ini.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Semua pocket sudah diisi hari ini.</p>
        )}
        {canManage && (
          <StockistPocketSheet kind="kas" companyId={companyId} pockets={pockets} onChanged={loadData} />
        )}
      </div>

      <div className="rounded-md border max-h-[65vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky top-0 z-20 bg-background">Pocket</TableHead>
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
              <KasRowEdit
                key={r.kasPocketId}
                row={r}
                canManage={canManage}
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
              <TableCell className="text-right">Total</TableCell>
              <TableCell />
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

function KasRowEdit({
  row,
  canManage,
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
  const reference = row.previousBalance ?? 0
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
        {row.name}
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        Rp {fmt(reference)}
        {row.previousBalance === null && (
          <div className="text-[10px] text-muted-foreground/60">(belum ada data)</div>
        )}
      </TableCell>
      <TableCell className="text-right">
        <NumberInput
          ref={registerCell(rowIndex, "balance")}
          value={row.balance}
          disabled={!editable}
          onValueChange={(val) => onChange(row.kasPocketId, "balance", val === undefined ? "" : String(val))}
          onBlur={() => onBlurSave(row.kasPocketId)}
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
          onChange={(e) => onChange(row.kasPocketId, "note", e.target.value)}
          onBlur={() => onBlurSave(row.kasPocketId)}
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
              onVerify={(status, note, correctedBalance) =>
                onVerify(row.kasPocketId, status, note, correctedBalance)
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
