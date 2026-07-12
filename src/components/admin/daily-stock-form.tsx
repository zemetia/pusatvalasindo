"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

type Company = { id: string; name: string }
type Branch = { id: string; name: string; companyId: string | null }
type StockItem = {
  id: string
  name: string
  code: string | null
  type: "CURRENCY" | "GOLD" | "CASH"
  sortOrder: number
}

type StockRow = {
  stockItemId: string
  name: string
  code: string | null
  type: string
  qty1: string
  qty2: string
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
  branches: Branch[]
}

export function DailyStockForm({ companies, branches }: Props) {
  const [companyId, setCompanyId] = useState("")
  const [branchId, setBranchId] = useState("")
  const [date, setDate] = useState(toDate(new Date()))
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)


  const loadData = useCallback(async (bid: string, d: string) => {
    setFetching(true)
    try {
      const [itemsRes, entriesRes] = await Promise.all([
        fetch(`/api/stock-items?branchId=${bid}`),
        fetch(`/api/stok-harian?branchId=${bid}&date=${d}`),
      ])

      const [itemsData, entriesData] = await Promise.all([
        itemsRes.json(),
        entriesRes.json(),
      ])

      const items: StockItem[] = itemsData.data ?? []
      const existingStock: Record<string, { qty1: string; qty2: string }> = {}
      for (const e of entriesData.data?.stockEntries ?? []) {
        existingStock[e.stockItemId] = {
          qty1: String(e.qty1 ?? 0),
          qty2: String(e.qty2 ?? 0),
        }
      }

      const builtRows: StockRow[] = items.map((item) => ({
        stockItemId: item.id,
        name: item.name,
        code: item.code,
        type: item.type,
        qty1: existingStock[item.id]?.qty1 ?? "0",
        qty2: existingStock[item.id]?.qty2 ?? "0",
      }))

      setStockRows(builtRows)
    } catch {
      toast.error("Gagal memuat data")
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (branchId && date) loadData(branchId, date)
  }, [branchId, date, loadData])


  const updateStock = (id: string, field: keyof StockRow, val: string) => {
    setStockRows((prev) => prev.map((r) => (r.stockItemId === id ? { ...r, [field]: val } : r)))
  }

  const totals = useMemo(() => {
    let kasTunai = 0

    for (const r of stockRows) {
      const qty = parseNum(r.qty1) + parseNum(r.qty2)
      if (r.type === "CASH" && r.name === "KAS TUNAI") {
        kasTunai += qty
      }
    }

    return { kasTunai }
  }, [stockRows])

  const handleSave = async () => {
    if (!branchId || !date) {
      toast.error("Pilih cabang dan tanggal terlebih dahulu")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/stok-harian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          date,
          stockEntries: stockRows.map((r) => {
            const qty1 = parseNum(r.qty1)
            const qty2 = parseNum(r.qty2)
            const closingQty = qty1 + qty2
            return {
              stockItemId: r.stockItemId,
              qty1,
              qty2,
              closingQty,
              rateIdr: null,
              totalIdr: null,
            }
          }),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.message || "Gagal menyimpan")
        return
      }
      toast.success("Stok harian berhasil disimpan")
    } catch {
      toast.error("Gagal menyimpan")
    } finally {
      setLoading(false)
    }
  }

  const groupedStock = useMemo(() => {
    const gold = stockRows.filter((r) => r.type === "GOLD")
    const currency = stockRows.filter((r) => r.type === "CURRENCY")
    const cash = stockRows.filter((r) => r.type === "CASH")
    return { gold, currency, cash }
  }, [stockRows])

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-zinc-500 uppercase text-[10px] font-bold tracking-wider">Tanggal</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-red-500/20 focus-visible:border-red-500"
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-zinc-500 uppercase text-[10px] font-bold tracking-wider">Pilih PT</label>
          <Select
            value={companyId}
            onValueChange={(val) => {
              setCompanyId(val)
              setBranchId("")
            }}
          >
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
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-zinc-500 uppercase text-[10px] font-bold tracking-wider">Pilih Cabang</label>
          <Select
            value={branchId}
            onValueChange={setBranchId}
            disabled={!companyId}
          >
            <SelectTrigger className="w-52 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800">
              <SelectValue placeholder={companyId ? "Pilih cabang" : "Pilih PT dulu"} />
            </SelectTrigger>
            <SelectContent>
              {branches
                .filter((b) => b.companyId === companyId)
                .map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={loading || !branchId || stockRows.length === 0}
          className="h-10 rounded-xl px-6 bg-red-600 hover:bg-red-700 text-white font-semibold transition-all shadow-sm disabled:opacity-50"
        >
          {loading ? "Menyimpan..." : "Simpan Stok Harian"}
        </Button>
      </div>

      {fetching && (
        <p className="text-sm text-muted-foreground">
          Memuat data...
        </p>
      )}

      {!fetching && branchId && stockRows.length === 0 && (
        <p className="text-sm text-muted-foreground">Belum ada item stok untuk cabang ini.</p>
      )}

      {stockRows.length > 0 && (
        <>
          {/* Stock Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead className="w-36 text-right">Qty 1</TableHead>
                  <TableHead className="w-36 text-right">Qty 2</TableHead>
                  <TableHead className="w-28 text-right">Total Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedStock.gold.length > 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={6} className="py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      Emas / Logam Mulia
                    </TableCell>
                  </TableRow>
                )}
                {groupedStock.gold.map((r, i) => (
                  <StockRowEdit key={r.stockItemId} row={r} displayIdx={i} onChange={updateStock} />
                ))}

                {groupedStock.currency.length > 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={6} className="py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      Mata Uang Asing
                    </TableCell>
                  </TableRow>
                )}
                {groupedStock.currency.map((r, i) => (
                  <StockRowEdit
                    key={r.stockItemId}
                    row={r}
                    displayIdx={i + groupedStock.gold.length}
                    onChange={updateStock}
                  />
                ))}

                {groupedStock.cash.length > 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={6} className="py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      Kas Tunai
                    </TableCell>
                  </TableRow>
                )}
                {groupedStock.cash.map((r, i) => (
                  <StockRowEdit
                    key={r.stockItemId}
                    row={r}
                    displayIdx={i + groupedStock.gold.length + groupedStock.currency.length}
                    onChange={updateStock}
                  />
                ))}

                {/* Subtotals */}
                <TableRow className="font-medium bg-muted/50">
                  <TableCell colSpan={5} className="text-right">Kas Tunai (IDR)</TableCell>
                  <TableCell className="text-right font-mono">
                    Rp {fmt(totals.kasTunai)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="rounded-md border p-4 bg-muted/20 flex flex-col gap-2 text-sm">
            <div className="flex justify-between font-semibold text-base">
              <span>Kas Tunai</span>
              <span className="font-mono">Rp {fmt(totals.kasTunai)}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Saldo rekening bank sekarang diisi per PT lewat halaman Stockist → tab Bank.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function StockRowEdit({
  row,
  displayIdx,
  onChange,
}: {
  row: StockRow
  displayIdx: number
  onChange: (id: string, field: keyof StockRow, val: string) => void
}) {
  const qty1 = parseNum(row.qty1)
  const qty2 = parseNum(row.qty2)
  const totalQty = qty1 + qty2
  const isCash = row.type === "CASH"

  return (
    <TableRow>
      <TableCell className="text-muted-foreground text-xs">{displayIdx + 1}</TableCell>
      <TableCell className="font-medium text-sm">{row.name}</TableCell>
      <TableCell>
        {row.code && <Badge variant="outline" className="text-xs">{row.code}</Badge>}
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          value={row.qty1}
          onChange={(e) => onChange(row.stockItemId, "qty1", e.target.value)}
          className="text-right font-mono w-full"
          min={0}
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          value={row.qty2}
          onChange={(e) => onChange(row.stockItemId, "qty2", e.target.value)}
          className="text-right font-mono w-full"
          min={0}
        />
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        {fmt(totalQty)}
      </TableCell>
    </TableRow>
  )
}
