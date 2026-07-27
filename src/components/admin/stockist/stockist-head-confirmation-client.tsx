"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Button } from "@/components/ui/button"
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  IconAlertTriangle,
  IconCheck,
  IconDownload,
  IconLoader2,
  IconLock,
  IconMinus,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

type Company = { id: string; name: string }
type StockItem = { id: string; code: string | null; name: string; type: "CURRENCY" | "LOGAM_MULIA" }
type SaveState = "idle" | "saving" | "saved" | "error"

type StockRow = {
  item: StockItem
  systemTotal: number
  confirmedQuantity: number | null
  confirmedAt: string | null
  qtyDraft: number | undefined
  saveState: SaveState
}

/** Satu angka IDR yang dikonfirmasi kepala cabang: dipakai untuk total stock, kas, dan bank. */
type IdrState = {
  systemTotal: number
  confirmedIdrValue: number | null
  confirmedAt: string | null
  idrDraft: number | undefined
  saveState: SaveState
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 })
}

function fmtTime(iso: string | null) {
  if (!iso) return "-"
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

function toDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

interface Props {
  companies: Company[]
  defaultCompanyId: string | null
  canEditPastDate: boolean
  canSelectCompany: boolean
}

export function StockistHeadConfirmationClient({
  companies,
  defaultCompanyId,
  canEditPastDate,
  canSelectCompany,
}: Props) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? companies[0]?.id ?? "")
  const [date, setDate] = useState(toDate(new Date()))
  const [fetching, setFetching] = useState(false)
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [stockIdr, setStockIdr] = useState<IdrState | null>(null)
  const [kas, setKas] = useState<IdrState | null>(null)
  const [bank, setBank] = useState<IdrState | null>(null)
  const [companyTotal, setCompanyTotal] = useState(0)
  const [exporting, setExporting] = useState(false)

  const isPastDate = date < toDate(new Date())
  const locked = isPastDate && !canEditPastDate

  const loadData = useCallback(async () => {
    if (!companyId || !date) return
    setFetching(true)
    try {
      // Satu request untuk stock + total stock + kas + bank + total PT (endpoint mengembalikan
      // semuanya sekaligus).
      const res = await fetch(`/api/stockist/head-confirmation?companyId=${companyId}&date=${date}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error(data.error || data.message || "Gagal memuat data")
        setStockRows([])
        setStockIdr(null)
        setKas(null)
        setBank(null)
        return
      }

      type ApiRow = {
        item: StockItem
        systemTotal: number
        confirmedQuantity: number | null
        confirmedAt: string | null
      }
      setStockRows(
        (data.data.rows as ApiRow[]).map((r) => ({
          item: r.item,
          systemTotal: r.systemTotal,
          confirmedQuantity: r.confirmedQuantity,
          confirmedAt: r.confirmedAt,
          qtyDraft: r.confirmedQuantity ?? undefined,
          saveState: "idle" as SaveState,
        }))
      )
      setCompanyTotal(data.data.companyTotal ?? 0)

      const totals = data.data.stockTotals
      setStockIdr({
        // Total IDR stock tidak punya pembanding sistem — hanya angka final kepala cabang.
        systemTotal: 0,
        confirmedIdrValue: totals.confirmedIdrValue,
        confirmedAt: totals.idrConfirmedAt,
        idrDraft: totals.confirmedIdrValue ?? undefined,
        saveState: "idle",
      })
      setKas(toIdrState(data.data.kas))
      setBank(toIdrState(data.data.bank))
    } catch {
      toast.error("Gagal memuat data")
      setStockRows([])
      setStockIdr(null)
      setKas(null)
      setBank(null)
    } finally {
      setFetching(false)
    }
  }, [companyId, date])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateStockDraft = (itemId: string, value: number | undefined) => {
    setStockRows((prev) => prev.map((r) => (r.item.id === itemId ? { ...r, qtyDraft: value } : r)))
  }

  const saveStockRow = async (itemId: string) => {
    const row = stockRows.find((r) => r.item.id === itemId)
    if (!row || locked) return
    if (row.qtyDraft === undefined) return
    if (row.qtyDraft === row.confirmedQuantity) return

    setStockRows((prev) => prev.map((r) => (r.item.id === itemId ? { ...r, saveState: "saving" } : r)))
    try {
      const res = await fetch("/api/stockist/head-confirmation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companyStockItemId: itemId,
          date,
          confirmedQuantity: row.qtyDraft,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
      setStockRows((prev) =>
        prev.map((r) =>
          r.item.id === itemId
            ? {
                ...r,
                confirmedQuantity: r.qtyDraft ?? null,
                confirmedAt: new Date().toISOString(),
                saveState: "saved",
              }
            : r
        )
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      setStockRows((prev) => prev.map((r) => (r.item.id === itemId ? { ...r, saveState: "error" } : r)))
    }
  }

  // Total stock IDR, kas, dan bank sama-sama satu angka per PT per tanggal, jadi satu
  // handler saja yang dibedakan endpoint + setter-nya.
  const saveIdr = async (
    state: IdrState | null,
    setState: React.Dispatch<React.SetStateAction<IdrState | null>>,
    url: string
  ) => {
    if (!state || locked || state.idrDraft === undefined) return
    if (state.idrDraft === state.confirmedIdrValue) return

    setState((prev) => (prev ? { ...prev, saveState: "saving" } : prev))
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, date, confirmedIdrValue: state.idrDraft }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
      setState((prev) =>
        prev
          ? {
              ...prev,
              confirmedIdrValue: prev.idrDraft ?? null,
              confirmedAt: new Date().toISOString(),
              saveState: "saved",
            }
          : prev
      )
      // Total PT dikembalikan langsung oleh PATCH — tanpa GET ulang seluruh halaman.
      if (typeof data.data?.companyTotal === "number") setCompanyTotal(data.data.companyTotal)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      setState((prev) => (prev ? { ...prev, saveState: "error" } : prev))
    }
  }

  const handleExport = async () => {
    if (!companyId || !date) return
    setExporting(true)
    try {
      const res = await fetch(
        `/api/stockist/head-confirmation/export?companyId=${companyId}&date=${date}`
      )
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || data?.message || "Gagal export Excel")
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cross-check-${companyId}-${date}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error("Gagal export Excel")
    } finally {
      setExporting(false)
    }
  }

  const stockRowsSorted = useMemo(
    () => [...stockRows].sort((a, b) => (a.item.type === b.item.type ? 0 : a.item.type === "LOGAM_MULIA" ? -1 : 1)),
    [stockRows]
  )

  // Baris total di bawah tabel: beda mata uang memang dijumlahkan mentah — permintaan client,
  // supaya selisih keseluruhan langsung kelihatan tanpa memeriksa baris satu per satu.
  const stockSystemSum = useMemo(
    () => stockRows.reduce((sum, r) => sum + r.systemTotal, 0),
    [stockRows]
  )
  const stockKepcabSum = useMemo(
    () => stockRows.reduce((sum, r) => sum + (r.qtyDraft ?? 0), 0),
    [stockRows]
  )
  const stockSumSelisih = stockKepcabSum - stockSystemSum

  return (
    <div className="flex flex-col gap-6">
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
        {canSelectCompany && (
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
        {companyId && (
          <Button
            size="sm"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={exporting}
            onClick={handleExport}
          >
            {exporting ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconDownload className="size-4" />
            )}
            Export Excel
          </Button>
        )}
      </div>

      {locked && (
        <Alert variant="destructive">
          <IconLock className="size-4" />
          <AlertTitle>Tanggal sudah lewat</AlertTitle>
          <AlertDescription>Edit untuk tanggal ini perlu otorisasi Super Admin.</AlertDescription>
        </Alert>
      )}

      {!companyId && <p className="text-sm text-muted-foreground">Pilih PT dan tanggal terlebih dahulu.</p>}

      {companyId && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label={`Total Stock Kepala Cabang — ${date}`} value={stockIdr?.confirmedIdrValue ?? 0} />
            <SummaryCard label={`Total Kas Kepala Cabang — ${date}`} value={kas?.confirmedIdrValue ?? 0} />
            <SummaryCard label={`Total Bank Kepala Cabang — ${date}`} value={bank?.confirmedIdrValue ?? 0} />
            <SummaryCard label={`Total Keseluruhan IDR PT — ${date}`} value={companyTotal} highlight />
          </div>

          {fetching && stockRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Memuat data...</p>
          ) : (
            <div className="rounded-md border max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky top-0 z-20 bg-background">Item</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-40 text-right">Total Sistem</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-52 text-right">
                      Total Kepala Cabang
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-32 text-right">Selisih</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-24">Jam</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRowsSorted.map((r) => {
                    const selisih = r.qtyDraft === undefined ? null : r.qtyDraft - r.systemTotal
                    return (
                      <TableRow key={r.item.id}>
                        <TableCell className="font-medium text-sm">
                          {r.item.name}
                          {r.item.type === "LOGAM_MULIA" && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground uppercase">Logam</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {fmt(r.systemTotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          <NumberInput
                            value={r.qtyDraft ?? ""}
                            disabled={locked}
                            onValueChange={(val) => updateStockDraft(r.item.id, val)}
                            onBlur={() => saveStockRow(r.item.id)}
                            className="text-right font-mono w-full"
                          />
                        </TableCell>
                        <TableCell className={selisihClass(selisih)}>
                          {selisih === null ? "-" : fmt(selisih)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtTime(r.confirmedAt)}</TableCell>
                        <TableCell>
                          <SaveIndicator state={r.saveState} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter className="sticky bottom-0 z-20 bg-muted">
                  {/* Total kuantitas lintas mata uang — sekadar penanda apakah masih ada selisih
                      keseluruhan, bukan angka yang punya arti satuan. */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="text-sm font-semibold">Total Keseluruhan</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {fmt(stockSystemSum)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold pr-4">
                      {fmt(stockKepcabSum)}
                    </TableCell>
                    <TableCell className={cn(selisihClass(stockSumSelisih), "font-semibold")}>
                      {fmt(stockSumSelisih)}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="text-sm font-semibold" colSpan={2}>
                      Total IDR (final)
                      <span className="ml-2 text-[10px] font-normal text-muted-foreground uppercase">
                        Valas + Logam
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <NumberInput
                        value={stockIdr?.idrDraft ?? ""}
                        disabled={locked || !stockIdr}
                        onValueChange={(val) =>
                          setStockIdr((prev) => (prev ? { ...prev, idrDraft: val } : prev))
                        }
                        onBlur={() =>
                          saveIdr(stockIdr, setStockIdr, "/api/stockist/head-confirmation/total")
                        }
                        className="text-right font-mono w-full"
                      />
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtTime(stockIdr?.confirmedAt ?? null)}
                    </TableCell>
                    <TableCell>
                      <SaveIndicator state={stockIdr?.saveState ?? "idle"} />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          <IdrCrossCheckSection
            title="Cross-Check Kas"
            state={kas}
            locked={locked}
            onChange={(val) => setKas((prev) => (prev ? { ...prev, idrDraft: val } : prev))}
            onBlur={() => saveIdr(kas, setKas, "/api/stockist/kas/head-confirmation")}
          />

          <IdrCrossCheckSection
            title="Cross-Check Bank"
            description="Total sistem = jumlah saldo Bank Harian seluruh rekening aktif PT pada tanggal ini."
            state={bank}
            locked={locked}
            onChange={(val) => setBank((prev) => (prev ? { ...prev, idrDraft: val } : prev))}
            onBlur={() => saveIdr(bank, setBank, "/api/stockist/bank/head-confirmation")}
          />
        </>
      )}
    </div>
  )
}

function toIdrState(api: {
  systemTotal: number
  confirmedIdrValue: number | null
  confirmedAt: string | null
}): IdrState {
  return {
    systemTotal: api.systemTotal,
    confirmedIdrValue: api.confirmedIdrValue,
    confirmedAt: api.confirmedAt,
    idrDraft: api.confirmedIdrValue ?? undefined,
    saveState: "idle",
  }
}

function selisihClass(selisih: number | null) {
  return cn(
    "text-right font-mono text-sm font-medium",
    selisih === null && "text-muted-foreground",
    selisih !== null && selisih === 0 && "text-emerald-600 dark:text-emerald-500",
    selisih !== null && selisih !== 0 && "text-destructive"
  )
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <Card className={cn(highlight && "border-emerald-500/40")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold font-mono">Rp {fmt(value)}</p>
      </CardContent>
    </Card>
  )
}

/** Kas dan bank punya bentuk cross-check identik: satu total sistem vs satu total kepala cabang. */
function IdrCrossCheckSection({
  title,
  description,
  state,
  locked,
  onChange,
  onBlur,
}: {
  title: string
  description?: string
  state: IdrState | null
  locked: boolean
  onChange: (value: number | undefined) => void
  onBlur: () => void
}) {
  if (!state) return null
  const selisih = state.idrDraft === undefined ? null : state.idrDraft - state.systemTotal

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mb-2">{description}</p>}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-36 text-right">Total Sistem</TableHead>
              <TableHead className="w-52 text-right">Total Kepala Cabang</TableHead>
              <TableHead className="w-32 text-right">Selisih</TableHead>
              <TableHead className="w-24">Jam</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                Rp {fmt(state.systemTotal)}
              </TableCell>
              <TableCell className="text-right">
                <NumberInput
                  value={state.idrDraft ?? ""}
                  disabled={locked}
                  onValueChange={onChange}
                  onBlur={onBlur}
                  className="text-right font-mono w-full"
                />
              </TableCell>
              <TableCell className={selisihClass(selisih)}>
                {selisih === null ? "-" : fmt(selisih)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{fmtTime(state.confirmedAt)}</TableCell>
              <TableCell>
                <SaveIndicator state={state.saveState} />
              </TableCell>
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
