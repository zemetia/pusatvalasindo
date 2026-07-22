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
  confirmedIdrValue: number | null
  confirmedAt: string | null
  qtyDraft: number | undefined
  idrDraft: number | undefined
  saveState: SaveState
}

type KasState = {
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
  const [kas, setKas] = useState<KasState | null>(null)
  const [companyTotal, setCompanyTotal] = useState(0)
  const [exporting, setExporting] = useState(false)

  const isPastDate = date < toDate(new Date())
  const locked = isPastDate && !canEditPastDate

  const loadData = useCallback(async () => {
    if (!companyId || !date) return
    setFetching(true)
    try {
      const [stockRes, kasRes] = await Promise.all([
        fetch(`/api/stockist/head-confirmation?companyId=${companyId}&date=${date}`),
        fetch(`/api/stockist/kas/head-confirmation?companyId=${companyId}&date=${date}`),
      ])
      const stockData = await stockRes.json()
      const kasData = await kasRes.json()

      if (!stockRes.ok || !stockData.success) {
        toast.error(stockData.error || stockData.message || "Gagal memuat data stock")
        setStockRows([])
      } else {
        type ApiRow = {
          item: StockItem
          systemTotal: number
          confirmedQuantity: number | null
          confirmedIdrValue: number | null
          confirmedAt: string | null
        }
        setStockRows(
          (stockData.data.rows as ApiRow[]).map((r) => ({
            item: r.item,
            systemTotal: r.systemTotal,
            confirmedQuantity: r.confirmedQuantity,
            confirmedIdrValue: r.confirmedIdrValue,
            confirmedAt: r.confirmedAt,
            qtyDraft: r.confirmedQuantity ?? undefined,
            idrDraft: r.confirmedIdrValue ?? undefined,
            saveState: "idle" as SaveState,
          }))
        )
        setCompanyTotal(stockData.data.companyTotal ?? 0)
      }

      if (!kasRes.ok || !kasData.success) {
        toast.error(kasData.error || kasData.message || "Gagal memuat data kas")
        setKas(null)
      } else {
        setKas({
          systemTotal: kasData.data.systemTotal,
          confirmedIdrValue: kasData.data.confirmedIdrValue,
          confirmedAt: kasData.data.confirmedAt,
          idrDraft: kasData.data.confirmedIdrValue ?? undefined,
          saveState: "idle",
        })
      }
    } catch {
      toast.error("Gagal memuat data")
      setStockRows([])
      setKas(null)
    } finally {
      setFetching(false)
    }
  }, [companyId, date])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateStockDraft = (itemId: string, field: "qtyDraft" | "idrDraft", value: number | undefined) => {
    setStockRows((prev) => prev.map((r) => (r.item.id === itemId ? { ...r, [field]: value } : r)))
  }

  const saveStockRow = async (itemId: string) => {
    const row = stockRows.find((r) => r.item.id === itemId)
    if (!row || locked) return
    if (row.qtyDraft === undefined || row.idrDraft === undefined) return
    if (row.qtyDraft === row.confirmedQuantity && row.idrDraft === row.confirmedIdrValue) return

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
          confirmedIdrValue: row.idrDraft,
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
                confirmedIdrValue: r.idrDraft ?? null,
                confirmedAt: new Date().toISOString(),
                saveState: "saved",
              }
            : r
        )
      )
      // Total keseluruhan PT ikut berubah di server setiap baris disimpan — refetch ringan.
      const totalRes = await fetch(`/api/stockist/head-confirmation?companyId=${companyId}&date=${date}`)
      const totalData = await totalRes.json()
      if (totalRes.ok && totalData.success) setCompanyTotal(totalData.data.companyTotal ?? 0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      setStockRows((prev) => prev.map((r) => (r.item.id === itemId ? { ...r, saveState: "error" } : r)))
    }
  }

  const updateKasDraft = (value: number | undefined) => {
    setKas((prev) => (prev ? { ...prev, idrDraft: value } : prev))
  }

  const saveKas = async () => {
    if (!kas || locked || kas.idrDraft === undefined) return
    if (kas.idrDraft === kas.confirmedIdrValue) return

    setKas((prev) => (prev ? { ...prev, saveState: "saving" } : prev))
    try {
      const res = await fetch("/api/stockist/kas/head-confirmation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, date, confirmedIdrValue: kas.idrDraft }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
      setKas((prev) =>
        prev
          ? {
              ...prev,
              confirmedIdrValue: prev.idrDraft ?? null,
              confirmedAt: new Date().toISOString(),
              saveState: "saved",
            }
          : prev
      )
      const totalRes = await fetch(`/api/stockist/head-confirmation?companyId=${companyId}&date=${date}`)
      const totalData = await totalRes.json()
      if (totalRes.ok && totalData.success) setCompanyTotal(totalData.data.companyTotal ?? 0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      setKas((prev) => (prev ? { ...prev, saveState: "error" } : prev))
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

  const stockTotalKepcab = useMemo(
    () => stockRows.reduce((sum, r) => sum + (r.confirmedIdrValue ?? 0), 0),
    [stockRows]
  )
  const kasTotalKepcab = kas?.confirmedIdrValue ?? 0

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
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Total Stock Kepala Cabang — {date}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">Rp {fmt(stockTotalKepcab)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Total Kas Kepala Cabang — {date}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">Rp {fmt(kasTotalKepcab)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Total Keseluruhan IDR PT — {date}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-mono">Rp {fmt(companyTotal)}</p>
              </CardContent>
            </Card>
          </div>

          {fetching && stockRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Memuat data...</p>
          ) : (
            <div className="rounded-md border max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky top-0 z-20 bg-background">Item</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-36 text-right">Total Sistem</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-44 text-right">
                      Total Kepala Cabang
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-52 text-right">Total IDR</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-32 text-right">Selisih</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-24">Jam</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRowsSorted.map((r) => {
                    const selisih = r.qtyDraft === undefined ? null : r.qtyDraft - r.systemTotal
                    const isMatch = selisih === 0
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
                            onValueChange={(val) => updateStockDraft(r.item.id, "qtyDraft", val)}
                            onBlur={() => saveStockRow(r.item.id)}
                            className="text-right font-mono w-full"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <NumberInput
                            value={r.idrDraft ?? ""}
                            disabled={locked}
                            onValueChange={(val) => updateStockDraft(r.item.id, "idrDraft", val)}
                            onBlur={() => saveStockRow(r.item.id)}
                            className="text-right font-mono w-full"
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono text-sm font-medium",
                            selisih === null && "text-muted-foreground",
                            selisih !== null && isMatch && "text-emerald-600 dark:text-emerald-500",
                            selisih !== null && !isMatch && "text-destructive"
                          )}
                        >
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
              </Table>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2">Cross-Check Kas</h3>
            {kas && (
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
                    {(() => {
                      const kasSelisih = kas.idrDraft === undefined ? null : kas.idrDraft - kas.systemTotal
                      const kasMatch = kasSelisih === 0
                      return (
                        <TableRow>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            Rp {fmt(kas.systemTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            <NumberInput
                              value={kas.idrDraft ?? ""}
                              disabled={locked}
                              onValueChange={updateKasDraft}
                              onBlur={saveKas}
                              className="text-right font-mono w-full"
                            />
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-mono text-sm font-medium",
                              kasSelisih === null && "text-muted-foreground",
                              kasSelisih !== null && kasMatch && "text-emerald-600 dark:text-emerald-500",
                              kasSelisih !== null && !kasMatch && "text-destructive"
                            )}
                          >
                            {kasSelisih === null ? "-" : fmt(kasSelisih)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtTime(kas.confirmedAt)}</TableCell>
                          <TableCell>
                            <SaveIndicator state={kas.saveState} />
                          </TableCell>
                        </TableRow>
                      )
                    })()}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
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
