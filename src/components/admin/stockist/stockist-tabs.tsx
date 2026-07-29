"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StockistGridClient } from "@/components/admin/stockist/stockist-grid-client"
import { KasGridClient } from "@/components/admin/stockist/kas-grid-client"
import { SectionCard, EmptyState } from "@/components/admin/page-shell"
import { IconDownload, IconLoader2 } from "@tabler/icons-react"

type Company = { id: string; name: string }

const LAST_SELECTION_KEY = "stockist:last-company"

function toDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function readLastSelection(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(LAST_SELECTION_KEY)
  } catch {
    return null
  }
}

interface Props {
  companies: Company[]
  defaultCompanyId: string | null
  canManage: boolean
  canSelectCompany: boolean
  /** Grid hari ini yang sudah dirender server, kalau PT-nya sudah pasti. */
  initialGrid?: unknown
  /** `${companyId}:${YYYY-MM-DD}` milik initialGrid — dipakai hanya kalau cocok. */
  initialGridKey?: string | null
}

export function StockistTabs({
  companies,
  defaultCompanyId,
  canManage,
  canSelectCompany,
  initialGrid,
  initialGridKey,
}: Props) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "")
  const [date, setDate] = useState(toDate(new Date()))
  const [mataUangAlert, setMataUangAlert] = useState({ beda: 0, belumReview: 0, belumIsi: 0 })
  const [kasUnfilled, setKasUnfilled] = useState(0)
  const [exporting, setExporting] = useState(false)

  // Remember the last PT a Super Admin/Owner picked, so they don't have to
  // reselect every time they open this page.
  useEffect(() => {
    if (!canSelectCompany) return
    const saved = readLastSelection()
    if (!saved) return
    if (companies.some((c) => c.id === saved)) setCompanyId(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!canSelectCompany || !companyId) return
    window.localStorage.setItem(LAST_SELECTION_KEY, companyId)
  }, [companyId, canSelectCompany])

  const mataUangIssues = mataUangAlert.beda + mataUangAlert.belumReview

  const handleExport = async () => {
    if (!companyId || !date) return
    setExporting(true)
    try {
      const res = await fetch(`/api/stockist/export?companyId=${companyId}&date=${date}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || data?.message || "Gagal export Excel")
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `export-stock-kas-${companyId}-${date}.xlsx`
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

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4 shadow-sm">
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">Tanggal</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-44"
          />
        </div>
        {canSelectCompany && (
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Pilih PT</label>
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
        {!canSelectCompany && companies.length > 0 && (
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">PT</label>
            <div className="bg-muted/40 flex h-9 items-center rounded-md border px-3 text-sm font-medium">
              {companies.find((c) => c.id === defaultCompanyId)?.name ?? "-"}
            </div>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!canManage && <Badge variant="soft">Read-only</Badge>}
          {companyId && (
            <Button size="sm" variant="outline" disabled={exporting} onClick={handleExport}>
              {exporting ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconDownload className="size-4" />
              )}
              Export Excel
            </Button>
          )}
        </div>
      </div>

      {!companyId && (
        <SectionCard padded={false}>
          <EmptyState
            title="Pilih PT terlebih dahulu"
            description="Grid stock & kas akan muncul setelah PT dan tanggal dipilih."
          />
        </SectionCard>
      )}

      {companyId && (
        <Tabs defaultValue="mata-uang" className="gap-4">
          <TabsList>
            <TabsTrigger value="mata-uang" className="gap-1.5">
              Mata Uang
              {mataUangIssues > 0 && (
                <Badge
                  variant={mataUangAlert.beda > 0 ? "danger" : "warning"}
                  className="h-4 min-w-4 rounded-full px-1 text-[10px]"
                >
                  {mataUangIssues}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="kas" className="gap-1.5">
              Tunai (Kas)
              {kasUnfilled > 0 && (
                <Badge variant="warning" className="h-4 min-w-4 rounded-full px-1 text-[10px]">
                  {kasUnfilled}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mata-uang">
            <StockistGridClient
              companyId={companyId}
              date={date}
              canManage={canManage}
              onAlertsChange={setMataUangAlert}
              initialGrid={initialGrid}
              initialGridKey={initialGridKey}
            />
          </TabsContent>
          <TabsContent value="kas">
            <KasGridClient
              companyId={companyId}
              date={date}
              canManage={canManage}
              onUnfilledChange={setKasUnfilled}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
