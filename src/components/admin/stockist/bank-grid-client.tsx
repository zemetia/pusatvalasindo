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
  tarikCek: string
  note: string
  savedBalance: string
  savedTarikCek: string
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

export function BankGridClient({ companyId, date, canManage, onUnfilledChange }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [fetching, setFetching] = useState(false)
  const rowsRef = useRef<Row[]>([])
  rowsRef.current = rows
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

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

      const accounts: Account[] = data.data.accounts ?? []
      const entries: Record<string, { balance: string; tarikCek: string; note: string | null }> =
        data.data.entries ?? {}
      const previous: Record<string, { balance: string; date: string }> = data.data.previous ?? {}

      const builtRows: Row[] = accounts.map((acc) => {
        const entry = entries[acc.id]
        const prev = previous[acc.id]
        const balance = entry?.balance ?? "0"
        const tarikCek = entry?.tarikCek ?? "0"
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
          tarikCek,
          note,
          savedBalance: balance,
          savedTarikCek: tarikCek,
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

  const updateRow = (id: string, field: "balance" | "tarikCek" | "note", val: string) => {
    setRows((prev) => prev.map((r) => (r.bankAccountId === id ? { ...r, [field]: val } : r)))
  }

  const saveRow = async (id: string) => {
    const row = rowsRef.current.find((r) => r.bankAccountId === id)
    if (!row || !canManage) return
    if (
      row.balance === row.savedBalance &&
      row.tarikCek === row.savedTarikCek &&
      row.note === row.savedNote
    ) {
      return
    }

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
              tarikCek: parseNum(row.tarikCek),
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
            ? {
                ...r,
                savedBalance: r.balance,
                savedTarikCek: r.tarikCek,
                savedNote: r.note,
                saveState: "saved",
                hasEntry: true,
              }
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

  const totals = useMemo(() => {
    let totalBalance = 0
    let totalTarikCek = 0
    let totalDelta = 0
    let unfilled = 0
    for (const r of rows) {
      const balance = parseNum(r.balance)
      const ref = r.previousBalance ?? r.fallbackBalance
      totalBalance += balance
      totalTarikCek += parseNum(r.tarikCek)
      totalDelta += balance - ref
      if (!r.hasEntry) unfilled += 1
    }
    return { totalBalance, totalTarikCek, totalDelta, unfilled }
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
        {totals.unfilled > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
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
              <TableHead className="sticky top-0 z-20 bg-background w-52 text-right">Saldo Hari Ini</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background w-36 text-right">Delta</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background w-36 text-right">Tarik Cek</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background w-44">Catatan</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <BankRowEdit
                key={r.bankAccountId}
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
              <TableCell colSpan={3} className="text-right">
                Total
              </TableCell>
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
              <TableCell className="text-right font-mono text-destructive">
                ({fmt(totals.totalTarikCek)})
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

function BankRowEdit({
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
  onChange: (id: string, field: "balance" | "tarikCek" | "note", val: string) => void
  onBlurSave: (id: string) => void
  inputRefs: RefObject<Map<string, HTMLInputElement>>
  rowIndex: number
  rowCount: number
}) {
  const balance = parseNum(row.balance)
  const reference = row.previousBalance ?? row.fallbackBalance
  const delta = balance - reference
  const isUnfilled = !row.hasEntry

  const registerRef = (field: "balance" | "tarikCek" | "note") => (el: HTMLInputElement | null) => {
    const key = `${rowIndex}:${field}`
    if (el) inputRefs.current.set(key, el)
    else inputRefs.current.delete(key)
  }

  const focusNextRow = (field: "balance" | "tarikCek" | "note") => {
    if (rowIndex >= rowCount - 1) return
    inputRefs.current.get(`${rowIndex + 1}:${field}`)?.focus()
  }

  const handleEnter = (field: "balance" | "tarikCek" | "note") => (e: KeyboardEvent<HTMLInputElement>) => {
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
        <NumberInput
          ref={registerRef("balance")}
          value={row.balance}
          disabled={!canManage}
          onValueChange={(val) => onChange(row.bankAccountId, "balance", val === undefined ? "" : String(val))}
          onBlur={() => onBlurSave(row.bankAccountId)}
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
      <TableCell className="text-right">
        <NumberInput
          ref={registerRef("tarikCek")}
          value={row.tarikCek}
          disabled={!canManage}
          onValueChange={(val) => onChange(row.bankAccountId, "tarikCek", val === undefined ? "" : String(val))}
          onBlur={() => onBlurSave(row.bankAccountId)}
          onKeyDown={handleEnter("tarikCek")}
          className="text-right font-mono w-full"
        />
      </TableCell>
      <TableCell>
        <Input
          ref={registerRef("note")}
          type="text"
          value={row.note}
          disabled={!canManage}
          placeholder="Opsional"
          onChange={(e) => onChange(row.bankAccountId, "note", e.target.value)}
          onBlur={() => onBlurSave(row.bankAccountId)}
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
