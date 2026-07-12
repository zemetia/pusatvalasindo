"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Badge } from "@/components/ui/badge"
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
import { IconAlertTriangle, IconCheck, IconLoader2, IconMinus } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

type Company = { id: string; name: string }

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

function toDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

interface Props {
  companies: Company[]
  defaultCompanyId: string | null
  canInput: boolean
}

export function DailyBankForm({ companies, defaultCompanyId, canInput }: Props) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "")
  const [date, setDate] = useState(toDate(new Date()))
  const [rows, setRows] = useState<Row[]>([])
  const [fetching, setFetching] = useState(false)

  const loadData = useCallback(async (cid: string, d: string) => {
    setFetching(true)
    try {
      const res = await fetch(`/api/bank-harian?companyId=${cid}&date=${d}`)
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
  }, [])

  useEffect(() => {
    if (companyId && date) loadData(companyId, date)
  }, [companyId, date, loadData])

  const updateRow = (id: string, field: "balance" | "tarikCek" | "note", val: string) => {
    setRows((prev) => prev.map((r) => (r.bankAccountId === id ? { ...r, [field]: val } : r)))
  }

  const saveRow = async (row: Row) => {
    if (!canInput) return
    if (
      row.balance === row.savedBalance &&
      row.tarikCek === row.savedTarikCek &&
      row.note === row.savedNote
    ) {
      return // tidak ada perubahan, skip autosave
    }

    const id = row.bankAccountId
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

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-zinc-500 uppercase text-[10px] font-bold tracking-wider">
            Tanggal
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-red-500/20 focus-visible:border-red-500"
          />
        </div>
        {!defaultCompanyId && (
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-zinc-500 uppercase text-[10px] font-bold tracking-wider">
              Pilih PT
            </label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="w-52 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800">
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
        )}
        {defaultCompanyId && companies.length > 0 && (
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-zinc-500 uppercase text-[10px] font-bold tracking-wider">
              PT
            </label>
            <div className="h-10 flex items-center px-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-sm font-medium">
              {companies.find((c) => c.id === defaultCompanyId)?.name ?? "-"}
            </div>
          </div>
        )}
        {!canInput && (
          <Badge variant="outline" className="h-10 px-3 flex items-center">
            Read-only
          </Badge>
        )}
      </div>

      {fetching && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Memuat data...</p>
      )}

      {!fetching && companyId && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Belum ada rekening bank aktif untuk PT ini.</p>
      )}

      {!companyId && (
        <p className="text-sm text-muted-foreground">Pilih PT dan tanggal terlebih dahulu.</p>
      )}

      {rows.length > 0 && (
        <>
          {totals.unfilled > 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
              <IconAlertTriangle className="size-4" />
              {totals.unfilled} rekening belum diisi hari ini.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Semua rekening sudah diisi hari ini.</p>
          )}
        </>
      )}

      {rows.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rekening PT</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="w-40 text-right">Saldo Kemarin</TableHead>
                <TableHead className="w-52 text-right">Saldo Hari Ini</TableHead>
                <TableHead className="w-36 text-right">Delta</TableHead>
                <TableHead className="w-36 text-right">Tarik Cek</TableHead>
                <TableHead className="w-44">Catatan</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <BankRowEdit
                  key={r.bankAccountId}
                  row={r}
                  canInput={canInput}
                  onChange={updateRow}
                  onBlurSave={saveRow}
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
      )}
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
  canInput,
  onChange,
  onBlurSave,
}: {
  row: Row
  canInput: boolean
  onChange: (id: string, field: "balance" | "tarikCek" | "note", val: string) => void
  onBlurSave: (row: Row) => void
}) {
  const balance = parseNum(row.balance)
  const reference = row.previousBalance ?? row.fallbackBalance
  const delta = balance - reference

  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{row.accountName}</TableCell>
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
          value={row.balance}
          disabled={!canInput}
          onValueChange={(val) => onChange(row.bankAccountId, "balance", val === undefined ? "" : String(val))}
          onBlur={() => onBlurSave(row)}
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
          value={row.tarikCek}
          disabled={!canInput}
          onValueChange={(val) => onChange(row.bankAccountId, "tarikCek", val === undefined ? "" : String(val))}
          onBlur={() => onBlurSave(row)}
          className="text-right font-mono w-full"
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          value={row.note}
          disabled={!canInput}
          placeholder="Opsional"
          onChange={(e) => onChange(row.bankAccountId, "note", e.target.value)}
          onBlur={() => onBlurSave(row)}
          className="w-full text-sm"
        />
      </TableCell>
      <TableCell>
        <SaveIndicator state={row.saveState} />
      </TableCell>
    </TableRow>
  )
}
