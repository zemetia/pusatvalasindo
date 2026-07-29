"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { IconLoader2 } from "@tabler/icons-react"

type Company = { id: string; name: string }
type Pocket = { id: string; name: string }
type MutationRow = {
  id: string
  type: string
  quantity: string
  balanceAfter: string
  note: string | null
  createdAt: string
  pocket: { name: string }
  companyStockItem: { code: string | null; name: string }
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 })
}

const TYPE_LABEL: Record<string, string> = {
  OPENING: "Saldo Awal",
  TOP_UP: "Top Up",
  WITHDRAWAL: "Withdrawal",
  TRANSFER_IN: "Transfer Masuk",
  TRANSFER_OUT: "Transfer Keluar",
  ADJUSTMENT: "Koreksi",
}

interface Props {
  companies: Company[]
  defaultCompanyId: string | null
}

export function StockistHistoryClient({ companies, defaultCompanyId }: Props) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? companies[0]?.id ?? "")
  const [pocketId, setPocketId] = useState<string>("all")
  const [pockets, setPockets] = useState<Pocket[]>([])
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [items, setItems] = useState<MutationRow[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (!companyId) return
    fetch(`/api/stockist/pockets?companyId=${companyId}`)
      .then((r) => r.json())
      .then((data) => setPockets(data?.data?.pockets ?? []))
      .catch(() => setPockets([]))
  }, [companyId])

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!companyId) return
      reset ? setLoading(true) : setLoadingMore(true)
      try {
        const params = new URLSearchParams({ companyId })
        if (pocketId !== "all") params.set("pocketId", pocketId)
        if (from) params.set("from", from)
        if (to) params.set("to", to)
        if (!reset && cursor) params.set("cursor", cursor)

        const res = await fetch(`/api/stockist/history?${params.toString()}`)
        const data = await res.json()
        if (!res.ok || !data.success) {
          toast.error(data.error || data.message || "Gagal memuat riwayat")
          return
        }
        setItems((prev) => (reset ? data.data.items : [...prev, ...data.data.items]))
        setCursor(data.data.nextCursor)
      } catch {
        toast.error("Gagal memuat riwayat")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [companyId, pocketId, from, to, cursor]
  )

  useEffect(() => {
    setCursor(null)
    fetchPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, pocketId, from, to])

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4 shadow-sm">
        {!defaultCompanyId && (
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">
              PT
            </label>
            <Select value={companyId} onValueChange={setCompanyId}>
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
        )}
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">
            Pocket
          </label>
          <Select value={pocketId} onValueChange={setPocketId}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Semua pocket" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua pocket</SelectItem>
              {pockets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">
            Dari
          </label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">
            Sampai
          </label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Memuat riwayat...</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Belum ada riwayat mutasi.</p>
      )}

      {items.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pocket</TableHead>
                <TableHead>Mata Uang</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Saldo Setelah</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-sm">{m.pocket.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.companyStockItem.code ?? m.companyStockItem.name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{TYPE_LABEL[m.type] ?? m.type}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(Number(m.quantity))}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmt(Number(m.balanceAfter))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.note ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {cursor && (
        <Button variant="outline" onClick={() => fetchPage(false)} disabled={loadingMore} className="self-center">
          {loadingMore && <IconLoader2 className="size-4 animate-spin" />}
          Muat lebih banyak
        </Button>
      )}
    </div>
  )
}
