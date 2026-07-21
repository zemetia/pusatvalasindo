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
import { BankGridClient } from "@/components/admin/stockist/bank-grid-client"
import { IconDownload, IconLoader2 } from "@tabler/icons-react"

type Company = { id: string; name: string }

const LAST_SELECTION_KEY = "bank-harian:last-company"

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
}

export function BankPageClient({ companies, defaultCompanyId, canManage, canSelectCompany }: Props) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "")
  const [date, setDate] = useState(toDate(new Date()))
  const [bankUnfilled, setBankUnfilled] = useState(0)
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

  const handleExport = async () => {
    if (!companyId || !date) return
    setExporting(true)
    try {
      const res = await fetch(`/api/bank-harian/export?companyId=${companyId}&date=${date}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || data?.message || "Gagal export Excel")
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `export-bank-${companyId}-${date}.xlsx`
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
        {!canSelectCompany && companies.length > 0 && (
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-zinc-500 uppercase text-[10px] font-bold tracking-wider">
              PT
            </label>
            <div className="h-10 flex items-center px-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-sm font-medium">
              {companies.find((c) => c.id === defaultCompanyId)?.name ?? "-"}
            </div>
          </div>
        )}
        {!canManage && (
          <Badge variant="outline" className="h-10 px-3 flex items-center">
            Read-only
          </Badge>
        )}
        {companyId && bankUnfilled > 0 && (
          <Badge className="h-10 px-3 flex items-center bg-amber-500">
            {bankUnfilled} belum diisi
          </Badge>
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

      {!companyId && (
        <p className="text-sm text-muted-foreground">Pilih PT dan tanggal terlebih dahulu.</p>
      )}

      {companyId && (
        <BankGridClient
          companyId={companyId}
          date={date}
          canManage={canManage}
          onUnfilledChange={setBankUnfilled}
        />
      )}
    </div>
  )
}
