"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NumberInput } from "@/components/ui/number-input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IconCheck, IconClockPause, IconLoader2, IconX } from "@tabler/icons-react"

export type DailyVerifyStatus = "BELUM_REVIEW" | "BENAR" | "BEDA"

export type PendingCorrection = { id: string; proposedValue: string; reason: string }

function fmt(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 })
}

/**
 * Sel verifikasi H+1 untuk baris harian Kas & Bank — dipakai bersama oleh kedua grid.
 * "Sesuai" langsung menyimpan; "Tidak sesuai" mewajibkan catatan dan angka penggantinya
 * hanya DIAJUKAN (menunggu persetujuan Owner/Super Admin), tidak langsung mengubah saldo.
 */
export function DailyVerifyCell({
  status,
  note,
  balance,
  pending,
  canVerify,
  onVerify,
}: {
  status: DailyVerifyStatus
  note: string | null
  balance: number
  pending?: PendingCorrection
  canVerify: boolean
  onVerify: (
    status: "BENAR" | "BEDA",
    note?: string,
    correctedBalance?: number
  ) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [corrected, setCorrected] = useState<number | undefined>(balance)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (next: "BENAR" | "BEDA") => {
    if (next === "BEDA" && !noteDraft.trim()) {
      toast.error("Catatan wajib diisi saat menandai tidak sesuai")
      return
    }
    setSubmitting(true)
    const okResult = await onVerify(
      next,
      next === "BEDA" ? noteDraft.trim() : undefined,
      next === "BEDA" && corrected !== undefined && corrected !== balance ? corrected : undefined
    )
    setSubmitting(false)
    if (okResult) setOpen(false)
  }

  if (pending) {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="outline" className="w-fit gap-1 border-amber-500/50 text-amber-700 dark:text-amber-400">
          <IconClockPause className="size-3" />
          Menunggu persetujuan
        </Badge>
        <span className="text-[10px] text-muted-foreground font-mono">
          usul: Rp {fmt(Number(pending.proposedValue))}
        </span>
      </div>
    )
  }

  if (status === "BENAR") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/50 text-emerald-700 dark:text-emerald-400">
        <IconCheck className="size-3" />
        Sesuai
      </Badge>
    )
  }

  if (status === "BEDA") {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="destructive" className="w-fit gap-1">
          <IconX className="size-3" />
          Tidak sesuai
        </Badge>
        {note && <span className="text-[10px] text-muted-foreground line-clamp-1">{note}</span>}
      </div>
    )
  }

  if (!canVerify) {
    return <span className="text-xs text-muted-foreground">Belum diverifikasi</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="outline" className="h-7" disabled={submitting} onClick={() => submit("BENAR")}>
        {submitting ? <IconLoader2 className="size-3.5 animate-spin" /> : <IconCheck className="size-3.5" />}
        Sesuai
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive">
            <IconX className="size-3.5" />
            Tidak
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">Ajukan koreksi</p>
              <p className="text-xs text-muted-foreground">
                Tersimpan: Rp {fmt(balance)}. Angka pengganti baru berlaku setelah disetujui
                Owner / Super Admin.
              </p>
            </div>
            <Textarea
              placeholder="Alasan (wajib) — mis. salah input, selisih hitung"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="text-sm min-h-16"
            />
            <div className="grid gap-1">
              <label className="text-[10px] uppercase text-muted-foreground font-medium">
                Jumlah yang benar
              </label>
              <NumberInput
                value={corrected}
                onValueChange={setCorrected}
                className="font-mono text-right"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={submitting}
                onClick={() => setOpen(false)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                disabled={submitting}
                onClick={() => submit("BEDA")}
              >
                {submitting ? <IconLoader2 className="size-4 animate-spin" /> : "Ajukan"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
