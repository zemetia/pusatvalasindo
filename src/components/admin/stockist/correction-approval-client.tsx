"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

type Company = { id: string; name: string }
type Target = "STOCKIST" | "KAS" | "BANK"
type Status = "PENDING" | "APPROVED" | "REJECTED"

type CorrectionRow = {
  id: string
  companyId: string
  companyName: string
  target: Target
  date: string
  targetLabel: string
  currentValue: string
  proposedValue: string
  reason: string
  status: Status
  requestedByName: string
  requestedAt: string
  decidedByName: string | null
  decidedAt: string | null
  decisionNote: string | null
}

const TARGET_LABEL: Record<Target, string> = {
  STOCKIST: "Stock Mata Uang",
  KAS: "Tunai (Kas)",
  BANK: "Bank Harian",
}

const ALL = "ALL"

// Stock dihitung dalam satuan item (lembar/gram), kas & bank dalam rupiah.
function fmtValue(value: string, target: Target) {
  const n = Number(value)
  if (target === "STOCKIST") return n.toLocaleString("id-ID", { maximumFractionDigits: 2 })
  return `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
}

interface Props {
  companies: Company[]
  defaultCompanyId: string | null
  canSelectCompany: boolean
  canApprove: boolean
}

export function CorrectionApprovalClient({
  companies,
  defaultCompanyId,
  canSelectCompany,
  canApprove,
}: Props) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? ALL)
  const [status, setStatus] = useState<Status | typeof ALL>("PENDING")
  const [target, setTarget] = useState<Target | typeof ALL>(ALL)
  const [rows, setRows] = useState<CorrectionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [deciding, setDeciding] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (companyId !== ALL) params.set("companyId", companyId)
      if (status !== ALL) params.set("status", status)
      if (target !== ALL) params.set("target", target)
      const res = await fetch(`/api/koreksi?${params.toString()}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || data.message || "Gagal memuat data")
        setRows([])
        return
      }
      setRows(data.data.items ?? [])
    } catch {
      toast.error("Gagal memuat data")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [companyId, status, target])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (id: string, action: "APPROVE" | "REJECT", decisionNote?: string) => {
    setDeciding(id)
    try {
      const res = await fetch(`/api/koreksi/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, decisionNote }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Gagal menyimpan")
      toast.success(data.message ?? "Tersimpan")
      await load()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
      return false
    } finally {
      setDeciding(null)
    }
  }

  const pendingCount = useMemo(() => rows.filter((r) => r.status === "PENDING").length, [rows])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        {canSelectCompany && (
          <div className="grid gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">PT</label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="h-10 w-52 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua PT</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!canSelectCompany && (
          <div className="grid gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">PT</label>
            <div className="flex h-10 items-center rounded-xl border px-3 text-sm font-medium">
              {companies.find((c) => c.id === defaultCompanyId)?.name ?? "-"}
            </div>
          </div>
        )}
        <div className="grid gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as Status | typeof ALL)}>
            <SelectTrigger className="h-10 w-44 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Menunggu</SelectItem>
              <SelectItem value="APPROVED">Disetujui</SelectItem>
              <SelectItem value="REJECTED">Ditolak</SelectItem>
              <SelectItem value={ALL}>Semua</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Jenis</label>
          <Select value={target} onValueChange={(v) => setTarget(v as Target | typeof ALL)}>
            <SelectTrigger className="h-10 w-44 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua jenis</SelectItem>
              <SelectItem value="STOCKIST">Stock Mata Uang</SelectItem>
              <SelectItem value="KAS">Tunai (Kas)</SelectItem>
              <SelectItem value="BANK">Bank Harian</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {status === "PENDING" && pendingCount > 0 && (
          <Badge className="flex h-10 items-center bg-amber-500 px-3">
            {pendingCount} menunggu persetujuan
          </Badge>
        )}
        {!canApprove && (
          <Badge variant="outline" className="flex h-10 items-center px-3">
            Read-only — hanya Owner / Super Admin yang bisa memutuskan
          </Badge>
        )}
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky top-0 z-20 bg-background">Tanggal Data</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background">Jenis</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background">Target</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background text-right">Tersimpan</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background text-right">Usulan</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background">Alasan</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background">Diajukan</TableHead>
              <TableHead className="sticky top-0 z-20 bg-background w-52">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                  Memuat data...
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                  Tidak ada pengajuan koreksi untuk filter ini.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const delta = Number(r.proposedValue) - Number(r.currentValue)
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {r.date}
                    {canSelectCompany && (
                      <div className="text-[10px] text-muted-foreground">{r.companyName}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{TARGET_LABEL[r.target]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{r.targetLabel}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {fmtValue(r.currentValue, r.target)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtValue(r.proposedValue, r.target)}
                    <div
                      className={cn(
                        "text-[10px]",
                        delta > 0 && "text-emerald-600 dark:text-emerald-500",
                        delta < 0 && "text-destructive"
                      )}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-56 text-sm">{r.reason}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {r.requestedByName}
                    <div className="text-[10px] text-muted-foreground">
                      {fmtDateTime(r.requestedAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.status === "PENDING" ? (
                      canApprove ? (
                        <DecisionActions
                          busy={deciding === r.id}
                          onApprove={() => decide(r.id, "APPROVE")}
                          onReject={(note) => decide(r.id, "REJECT", note)}
                        />
                      ) : (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                          Menunggu
                        </Badge>
                      )
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <Badge
                          variant={r.status === "APPROVED" ? "outline" : "destructive"}
                          className={cn(
                            "w-fit",
                            r.status === "APPROVED" &&
                              "border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
                          )}
                        >
                          {r.status === "APPROVED" ? "Disetujui" : "Ditolak"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {r.decidedByName ?? "—"}
                          {r.decidedAt ? ` · ${fmtDateTime(r.decidedAt)}` : ""}
                        </span>
                        {r.decisionNote && (
                          <span className="text-[10px] text-muted-foreground">
                            &quot;{r.decisionNote}&quot;
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function DecisionActions({
  busy,
  onApprove,
  onReject,
}: {
  busy: boolean
  onApprove: () => Promise<boolean>
  onReject: (note?: string) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" className="h-7" disabled={busy} onClick={onApprove}>
        {busy ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconCheck className="size-3.5" />}
        Setujui
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-destructive hover:text-destructive"
            disabled={busy}
          >
            <IconX className="size-3.5" />
            Tolak
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Tolak pengajuan</p>
            <Textarea
              placeholder="Alasan penolakan (opsional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-16 text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                disabled={busy}
                onClick={async () => {
                  const done = await onReject(note.trim() || undefined)
                  if (done) setOpen(false)
                }}
              >
                Tolak
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
