"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { NumberInput } from "@/components/ui/number-input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { IconAlertTriangle, IconCheck, IconChecks, IconLoader2, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { StockistPocketSheet } from "@/components/admin/stockist/stockist-pocket-sheet"

type Pocket = { id: string; name: string; code: string | null; isActive: boolean }
type StockItem = { id: string; code: string | null; name: string }
type CheckStatus = "BELUM_REVIEW" | "BENAR" | "BEDA"
type Check = {
  pocketId: string
  companyStockItemId: string
  status: CheckStatus
  note: string | null
  enteredQuantity: number | null
  filledAt: string | null
}

// What a cell actually renders as, derived from whether it's been filled and whether the
// fill date has already passed (review only opens up the day after it was filled).
type CellState = "empty_fillable" | "not_filled" | "filled_today" | CheckStatus

interface Props {
  companyId: string
  date: string
  canManage: boolean
  onAlertsChange?: (alerts: { beda: number; belumReview: number; belumIsi: number }) => void
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 })
}

function cellState(check: Check | undefined, isToday: boolean): CellState {
  if (!check || check.enteredQuantity === null) {
    return isToday ? "empty_fillable" : "not_filled"
  }
  if (isToday) return "filled_today"
  return check.status
}

function stateBg(state: CellState) {
  if (state === "BENAR") return "bg-emerald-50 dark:bg-emerald-950/40"
  if (state === "BEDA") return "bg-red-50 dark:bg-red-950/40"
  if (state === "BELUM_REVIEW") return "bg-amber-50 dark:bg-amber-950/30"
  if (state === "filled_today") return "bg-muted/50"
  return "bg-background"
}

function stateText(state: CellState) {
  if (state === "BENAR") return "text-emerald-700 dark:text-emerald-400"
  if (state === "BEDA") return "text-red-700 dark:text-red-400"
  if (state === "BELUM_REVIEW") return "text-amber-700 dark:text-amber-400"
  return "text-muted-foreground"
}

function stateLabel(state: CellState) {
  if (state === "BENAR") return "Benar"
  if (state === "BEDA") return "Beda"
  if (state === "BELUM_REVIEW") return "Klik untuk review"
  if (state === "filled_today") return "Sudah diisi"
  if (state === "empty_fillable") return "Klik untuk isi"
  return "Tidak diisi"
}

export function StockistGridClient({ companyId, date, canManage, onAlertsChange }: Props) {
  const isMobile = useIsMobile()
  const [pockets, setPockets] = useState<Pocket[]>([])
  const [currencies, setCurrencies] = useState<StockItem[]>([])
  const [checks, setChecks] = useState<Record<string, Check>>({})
  const [serverDate, setServerDate] = useState<string | null>(null)
  const [alerts, setAlerts] = useState({ beda: 0, belumReview: 0, belumIsi: 0, totalCells: 0 })
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [activeCell, setActiveCell] = useState<{ pocketId: string; companyStockItemId: string } | null>(
    null
  )

  const isToday = serverDate !== null && date === serverDate

  const onAlertsChangeRef = useRef(onAlertsChange)
  onAlertsChangeRef.current = onAlertsChange
  useEffect(() => {
    onAlertsChangeRef.current?.({
      beda: alerts.beda,
      belumReview: alerts.belumReview,
      belumIsi: alerts.belumIsi,
    })
  }, [alerts.beda, alerts.belumReview, alerts.belumIsi])

  const load = useCallback(async () => {
    if (!companyId || !date) return
    setLoading(true)
    try {
      const res = await fetch(`/api/stockist/grid?companyId=${companyId}&date=${date}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || data.message || "Gagal memuat data")
        return
      }
      const g = data.data
      setPockets((g.pockets ?? []).filter((p: Pocket) => p.isActive))
      setCurrencies(g.currencies ?? [])
      setServerDate(g.serverDate ?? null)
      const checkMap: Record<string, Check> = {}
      for (const c of g.checks ?? []) {
        checkMap[`${c.pocketId}:${c.companyStockItemId}`] = {
          ...c,
          enteredQuantity: c.enteredQuantity === null ? null : Number(c.enteredQuantity),
        }
      }
      setChecks(checkMap)
      setAlerts(g.alerts ?? { beda: 0, belumReview: 0, belumIsi: 0, totalCells: 0 })
    } catch {
      toast.error("Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }, [companyId, date])

  useEffect(() => {
    load()
  }, [load])

  const fillCell = useCallback(
    async (pocketId: string, companyStockItemId: string, quantity: number) => {
      const key = `${pocketId}:${companyStockItemId}`
      try {
        const res = await fetch("/api/stockist/daily-check/fill", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pocketId, companyStockItemId, date, quantity }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
        setChecks((prev) => ({
          ...prev,
          [key]: {
            pocketId,
            companyStockItemId,
            status: "BELUM_REVIEW",
            note: null,
            enteredQuantity: quantity,
            filledAt: new Date().toISOString(),
          },
        }))
        setAlerts((prev) => ({ ...prev, belumIsi: Math.max(0, prev.belumIsi - 1) }))
        toast.success("Opname tersimpan")
        setActiveCell(null)
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
        return false
      }
    },
    [date]
  )

  const markCheck = useCallback(
    async (
      pocketId: string,
      companyStockItemId: string,
      status: "BENAR" | "BEDA",
      note?: string,
      correctedQuantity?: number,
      silent?: boolean
    ) => {
      const key = `${pocketId}:${companyStockItemId}`
      const prevCheck = checks[key]
      if (!prevCheck) return false

      setChecks((prev) => ({
        ...prev,
        [key]: { ...prevCheck, status, note: note ?? null },
      }))

      try {
        const res = await fetch("/api/stockist/daily-check", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pocketId, companyStockItemId, date, status, note, correctedQuantity }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
        if (!silent) toast.success(status === "BENAR" ? "Ditandai Benar" : "Ditandai Beda")
        setActiveCell(null)
        setAlerts((prev) => {
          const wasBeda = prevCheck.status === "BEDA"
          const wasBelum = prevCheck.status === "BELUM_REVIEW"
          return {
            ...prev,
            beda: prev.beda + (status === "BEDA" ? 1 : 0) - (wasBeda ? 1 : 0),
            belumReview: prev.belumReview - (wasBelum ? 1 : 0),
          }
        })
        return true
      } catch (err) {
        setChecks((prev) => ({ ...prev, [key]: prevCheck }))
        if (!silent) toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
        return false
      }
    },
    [checks, date]
  )

  const markAllBenar = useCallback(async () => {
    const pending: { pocketId: string; companyStockItemId: string }[] = []
    for (const p of pockets) {
      for (const cur of currencies) {
        const key = `${p.id}:${cur.id}`
        if (cellState(checks[key], isToday) === "BELUM_REVIEW") {
          pending.push({ pocketId: p.id, companyStockItemId: cur.id })
        }
      }
    }
    if (pending.length === 0) return
    setMarkingAll(true)
    try {
      const results = await Promise.all(
        pending.map((c) => markCheck(c.pocketId, c.companyStockItemId, "BENAR", undefined, undefined, true))
      )
      const succeeded = results.filter(Boolean).length
      const failed = results.length - succeeded
      if (failed === 0) {
        toast.success(`${succeeded} sel ditandai Benar`)
      } else {
        toast.error(`${succeeded} sel berhasil, ${failed} gagal — coba lagi untuk sisanya`)
      }
    } finally {
      setMarkingAll(false)
    }
  }, [pockets, currencies, checks, isToday, markCheck])

  const activePocket = activeCell ? pockets.find((p) => p.id === activeCell.pocketId) : undefined
  const activeCurrency = activeCell
    ? currencies.find((c) => c.id === activeCell.companyStockItemId)
    : undefined
  const activeKey = activeCell ? `${activeCell.pocketId}:${activeCell.companyStockItemId}` : null
  const activeState = activeCell ? cellState(checks[activeKey!], isToday) : undefined
  const activeIsFillable = activeState === "empty_fillable"
  const activeIsReviewable =
    activeState === "BELUM_REVIEW" || activeState === "BENAR" || activeState === "BEDA"

  if (loading && currencies.length === 0) {
    return <p className="text-sm text-muted-foreground">Memuat data...</p>
  }

  if (!loading && (pockets.length === 0 || currencies.length === 0)) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Belum ada pocket atau mata uang aktif untuk PT ini.
        </p>
        {canManage && (
          <div>
            <StockistPocketSheet kind="stockist" companyId={companyId} pockets={pockets} onChanged={load} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isToday ? (
          alerts.belumIsi > 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
              <IconAlertTriangle className="size-4" />
              {alerts.belumIsi} sel belum diisi hari ini.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Semua sel sudah diisi hari ini.</p>
          )
        ) : alerts.beda > 0 || alerts.belumReview > 0 ? (
          <Alert
            variant={alerts.beda > 0 ? "destructive" : "default"}
            className="flex-1 min-w-64"
          >
            <IconAlertTriangle />
            <AlertTitle>
              {alerts.beda > 0 && `${alerts.beda} sel Beda`}
              {alerts.beda > 0 && alerts.belumReview > 0 && " · "}
              {alerts.belumReview > 0 && `${alerts.belumReview} sel Belum Review`}
            </AlertTitle>
            <AlertDescription>dari sel yang diisi tanggal ini.</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">Semua sel yang diisi tanggal ini sudah direview.</p>
        )}
        <div className="flex items-center gap-2">
          {canManage && !isToday && alerts.belumReview > 0 && (
            <Button size="sm" variant="outline" disabled={markingAll} onClick={markAllBenar}>
              {markingAll ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconChecks className="size-4" />
              )}
              Tandai Semua Benar
            </Button>
          )}
          {canManage && (
            <StockistPocketSheet kind="stockist" companyId={companyId} pockets={pockets} onChanged={load} />
          )}
        </div>
      </div>

      <div className="rounded-md border max-h-[65vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 top-0 z-30 bg-background border-r">
                Mata Uang
              </TableHead>
              {pockets.map((p) => (
                <TableHead key={p.id} className="sticky top-0 z-20 bg-background text-center min-w-[104px]">
                  {p.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {currencies.map((cur) => (
              <TableRow key={cur.id}>
                <TableCell className="sticky left-0 z-10 bg-background border-r font-medium whitespace-nowrap">
                  <div>{cur.name}</div>
                  {cur.code && (
                    <div className="text-[10px] text-muted-foreground font-normal">{cur.code}</div>
                  )}
                </TableCell>
                {pockets.map((p) => {
                  const key = `${p.id}:${cur.id}`
                  const check = checks[key]
                  const state = cellState(check, isToday)
                  const qty = check?.enteredQuantity ?? null
                  const clickable =
                    canManage && state !== "not_filled" && state !== "filled_today"
                  const isActive =
                    activeCell?.pocketId === p.id && activeCell?.companyStockItemId === cur.id

                  const cellInner = (
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() =>
                        clickable && setActiveCell({ pocketId: p.id, companyStockItemId: cur.id })
                      }
                      className={cn(
                        "w-full h-full px-2 py-2 text-right font-mono text-sm transition-colors",
                        stateBg(state),
                        clickable && "cursor-pointer hover:brightness-95 dark:hover:brightness-110",
                        !clickable && "cursor-default"
                      )}
                    >
                      <div>{qty === null ? "—" : fmt(qty)}</div>
                      <div className={cn("text-[10px] font-sans font-normal", stateText(state))}>
                        {stateLabel(state)}
                      </div>
                    </button>
                  )

                  return (
                    <TableCell key={p.id} className="p-0 min-w-[104px]">
                      {!clickable || isMobile ? (
                        cellInner
                      ) : (
                        <Popover
                          open={isActive}
                          onOpenChange={(o) =>
                            setActiveCell(o ? { pocketId: p.id, companyStockItemId: cur.id } : null)
                          }
                        >
                          <PopoverTrigger asChild>{cellInner}</PopoverTrigger>
                          <PopoverContent align="center" className="w-72">
                            {state === "empty_fillable" ? (
                              <FillCellForm
                                pocketName={p.name}
                                currencyCode={cur.code ?? cur.name}
                                onSubmit={(quantity) => fillCell(p.id, cur.id, quantity)}
                              />
                            ) : (
                              <CellActionForm
                                pocketName={p.name}
                                currencyCode={cur.code ?? cur.name}
                                qty={qty ?? 0}
                                status={check?.status ?? "BELUM_REVIEW"}
                                note={check?.note ?? null}
                                onBenar={() => markCheck(p.id, cur.id, "BENAR")}
                                onBeda={(note, corrected) =>
                                  markCheck(p.id, cur.id, "BEDA", note, corrected)
                                }
                              />
                            )}
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <Drawer open={isMobile && !!activeCell} onOpenChange={(o) => !o && setActiveCell(null)}>
          <DrawerContent>
            {activePocket && activeCurrency && activeKey && activeCell && (
              <>
                <DrawerHeader>
                  <DrawerTitle>
                    {activeCurrency.code ?? activeCurrency.name} — {activePocket.name}
                  </DrawerTitle>
                  {activeIsReviewable && (
                    <DrawerDescription>
                      Diisi: {fmt(checks[activeKey]?.enteredQuantity ?? 0)}
                    </DrawerDescription>
                  )}
                </DrawerHeader>
                <div className="px-4 pb-6">
                  {activeIsFillable ? (
                    <FillCellForm
                      pocketName={activePocket.name}
                      currencyCode={activeCurrency.code ?? activeCurrency.name}
                      onSubmit={(quantity) => fillCell(activeCell.pocketId, activeCell.companyStockItemId, quantity)}
                      hideHeader
                    />
                  ) : (
                    <CellActionForm
                      pocketName={activePocket.name}
                      currencyCode={activeCurrency.code ?? activeCurrency.name}
                      qty={checks[activeKey]?.enteredQuantity ?? 0}
                      status={checks[activeKey]?.status ?? "BELUM_REVIEW"}
                      note={checks[activeKey]?.note ?? null}
                      onBenar={() => markCheck(activeCell.pocketId, activeCell.companyStockItemId, "BENAR")}
                      onBeda={(note, corrected) =>
                        markCheck(activeCell.pocketId, activeCell.companyStockItemId, "BEDA", note, corrected)
                      }
                      hideHeader
                    />
                  )}
                </div>
              </>
            )}
          </DrawerContent>
        </Drawer>
      )}
    </div>
  )
}

function FillCellForm({
  pocketName,
  currencyCode,
  onSubmit,
  hideHeader,
}: {
  pocketName: string
  currencyCode: string
  onSubmit: (quantity: number) => Promise<unknown> | void
  hideHeader?: boolean
}) {
  const [draft, setDraft] = useState<number | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (draft === undefined) {
      toast.error("Jumlah opname wajib diisi")
      return
    }
    setSubmitting(true)
    await onSubmit(draft)
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {!hideHeader && (
        <div>
          <p className="text-sm font-medium">
            {currencyCode} — {pocketName}
          </p>
          <p className="text-xs text-muted-foreground">Belum diisi hari ini</p>
        </div>
      )}
      <div className="grid gap-1">
        <label className="text-[10px] uppercase text-muted-foreground font-medium">
          Jumlah opname
        </label>
        <NumberInput
          autoFocus
          value={draft}
          onValueChange={setDraft}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="font-mono text-right"
        />
      </div>
      <Button size="sm" disabled={submitting} onClick={submit}>
        {submitting ? <IconLoader2 className="size-4 animate-spin" /> : <IconCheck className="size-4" />}
        Simpan
      </Button>
    </div>
  )
}

function CellActionForm({
  pocketName,
  currencyCode,
  qty,
  status,
  note,
  onBenar,
  onBeda,
  hideHeader,
}: {
  pocketName: string
  currencyCode: string
  qty: number
  status: CheckStatus
  note: string | null
  onBenar: () => Promise<unknown> | void
  onBeda: (note: string, correctedQuantity?: number) => Promise<unknown> | void
  hideHeader?: boolean
}) {
  const [showBedaForm, setShowBedaForm] = useState(false)
  const [noteDraft, setNoteDraft] = useState(note ?? "")
  const [correctedDraft, setCorrectedDraft] = useState<number | undefined>(qty)
  const [submitting, setSubmitting] = useState(false)

  const submitBenar = async () => {
    setSubmitting(true)
    await onBenar()
    setSubmitting(false)
  }

  const submitBeda = async () => {
    if (!noteDraft.trim()) {
      toast.error("Catatan wajib diisi saat menandai Beda")
      return
    }
    setSubmitting(true)
    const corrected = correctedDraft ?? qty
    await onBeda(noteDraft.trim(), corrected !== qty ? corrected : undefined)
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {!hideHeader && (
        <div>
          <p className="text-sm font-medium">
            {currencyCode} — {pocketName}
          </p>
          <p className="text-xs text-muted-foreground">Diisi: {fmt(qty)}</p>
        </div>
      )}
      {status !== "BELUM_REVIEW" && (
        <p className="text-xs text-muted-foreground">
          Status sekarang: <span className="font-medium">{stateLabel(status)}</span>
          {note ? ` — "${note}"` : ""}
        </p>
      )}
      {!showBedaForm ? (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={submitting} onClick={submitBenar}>
            {submitting ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconCheck className="size-4" />
            )}
            Tandai Benar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => setShowBedaForm(true)}
          >
            <IconX className="size-4" />
            Tandai Beda
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Catatan (wajib) — mis. kurang 50rb, salah hitung kemarin"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            className="text-sm min-h-16"
          />
          <div className="grid gap-1">
            <label className="text-[10px] uppercase text-muted-foreground font-medium">
              Koreksi saldo (opsional)
            </label>
            <NumberInput
              value={correctedDraft}
              onValueChange={setCorrectedDraft}
              className="font-mono text-right"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setShowBedaForm(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              disabled={submitting}
              onClick={submitBeda}
            >
              {submitting ? <IconLoader2 className="size-4 animate-spin" /> : "Simpan Beda"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
