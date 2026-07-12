"use client"

import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
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
import { StockistPocketSheet } from "@/components/admin/stockist/stockist-pocket-sheet"

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

export function KasGridClient({ companyId, date, canManage, onUnfilledChange }: Props) {
  const [pockets, setPockets] = useState<Pocket[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [fetching, setFetching] = useState(false)
  const rowsRef = useRef<Row[]>([])
  rowsRef.current = rows
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

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
      const entries: Record<string, { balance: string; note: string | null }> =
        data.data.entries ?? {}
      const previous: Record<string, { balance: string; date: string }> = data.data.previous ?? {}

      setPockets(data.data.pockets ?? [])

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

  const totals = useMemo(() => {
    let totalBalance = 0
    let totalDelta = 0
    let unfilled = 0
    for (const r of rows) {
      const balance = parseNum(r.balance)
      const ref = r.previousBalance ?? 0
      totalBalance += balance
      totalDelta += balance - ref
      if (!r.hasEntry) unfilled += 1
    }
    return { totalBalance, totalDelta, unfilled }
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
        {totals.unfilled > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
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

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pocket</TableHead>
              <TableHead className="w-40 text-right">Saldo Kemarin</TableHead>
              <TableHead className="w-52 text-right">Saldo Hari Ini</TableHead>
              <TableHead className="w-36 text-right">Delta</TableHead>
              <TableHead className="w-44">Catatan</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <KasRowEdit
                key={r.kasPocketId}
                row={r}
                canManage={canManage}
                onChange={updateRow}
                onBlurSave={saveRow}
                inputRefs={inputRefs}
                rowIndex={i}
                rowCount={rows.length}
              />
            ))}
            <TableRow className="font-medium bg-muted/50">
              <TableCell className="text-right">Total</TableCell>
              <TableCell />
              <TableCell className="text-right font-mono">Rp {fmt(totals.totalBalance)}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono",
                  totals.totalDelta > 0 && "text-emerald-600 dark:text-emerald-500",
                  totals.totalDelta < 0 && "text-destructive"
                )}
              >
                {totals.totalDelta > 0 ? "+" : ""}
                {fmt(totals.totalDelta)}
              </TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
  if (state === "saved") return <IconCheck className="size-4 text-emerald-600 dark:text-emerald-500" />
  if (state === "error") return <IconAlertTriangle className="size-4 text-destructive" />
  return <IconMinus className="size-4 text-muted-foreground/30" />
}

function KasRowEdit({
  row,
  canManage,
  onChange,
  onBlurSave,
  inputRefs,
  rowIndex,
  rowCount,
}: {
  row: Row
  canManage: boolean
  onChange: (id: string, field: "balance" | "note", val: string) => void
  onBlurSave: (id: string) => void
  inputRefs: RefObject<Map<string, HTMLInputElement>>
  rowIndex: number
  rowCount: number
}) {
  const balance = parseNum(row.balance)
  const reference = row.previousBalance ?? 0
  const delta = balance - reference
  const isUnfilled = !row.hasEntry

  const registerRef = (field: "balance" | "note") => (el: HTMLInputElement | null) => {
    const key = `${rowIndex}:${field}`
    if (el) inputRefs.current.set(key, el)
    else inputRefs.current.delete(key)
  }

  // Enter moves focus to the same field one row down, Excel-style — blur (which
  // autosaves) fires naturally before the next input takes focus.
  const focusNextRow = (field: "balance" | "note") => {
    if (rowIndex >= rowCount - 1) return
    inputRefs.current.get(`${rowIndex + 1}:${field}`)?.focus()
  }

  const handleEnter = (field: "balance" | "note") => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    focusNextRow(field)
  }

  return (
    <TableRow className={cn(isUnfilled && "bg-amber-50/60 dark:bg-amber-950/20")}>
      <TableCell className="font-medium text-sm">
        <span
          className={cn(
            "inline-block size-1.5 rounded-full mr-1.5 align-middle",
            isUnfilled ? "bg-amber-500" : "bg-emerald-500"
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
          ref={registerRef("balance")}
          value={row.balance}
          disabled={!canManage}
          onValueChange={(val) => onChange(row.kasPocketId, "balance", val === undefined ? "" : String(val))}
          onBlur={() => onBlurSave(row.kasPocketId)}
          onKeyDown={handleEnter("balance")}
          className="text-right font-mono w-full"
        />
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono text-sm",
          delta > 0 && "text-emerald-600 dark:text-emerald-500",
          delta < 0 && "text-destructive"
        )}
      >
        {delta > 0 ? "+" : ""}
        {fmt(delta)}
      </TableCell>
      <TableCell>
        <Input
          ref={registerRef("note")}
          type="text"
          value={row.note}
          disabled={!canManage}
          placeholder="Opsional"
          onChange={(e) => onChange(row.kasPocketId, "note", e.target.value)}
          onBlur={() => onBlurSave(row.kasPocketId)}
          onKeyDown={handleEnter("note")}
          className="w-full text-sm"
        />
      </TableCell>
      <TableCell>
        <SaveIndicator state={row.saveState} />
      </TableCell>
    </TableRow>
  )
}
