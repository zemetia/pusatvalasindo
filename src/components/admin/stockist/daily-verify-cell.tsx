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

export type ApprovedCorrection = {
  id: string
  currentValue: string
  proposedValue: string
  reason: string
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 })
}

/** Tag lembut yang menandai sel ini pernah salah dan sudah dikoreksi (disetujui). */
function CorrectedTag({ approved }: { approved: ApprovedCorrection }) {
  return (
    <span
      title={`Sebelumnya Rp ${fmt(Number(approved.currentValue))} — dikoreksi jadi Rp ${fmt(
        Number(approved.proposedValue)
      )}. Alasan: ${approved.reason}`}
      className="w-fit rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive"
    >
      Pernah dikoreksi
    </span>
  )
}

/**
 * Sel verifikasi H+1 untuk baris harian Kas & Bank — dipakai bersama oleh kedua grid.
 * "Sesuai" langsung menyimpan; "Tidak sesuai" mewajibkan catatan dan angka penggantinya
 * hanya DIAJUKAN (menunggu persetujuan Owner/Super Admin), tidak langsung mengubah saldo.
 *
 * Kecuali untuk pemegang izin "Koreksi Langsung Tanpa Persetujuan" pada PT ini
 * (`canDirectCorrect`): angkanya berlaku saat itu juga, dan kalimatnya menyesuaikan.
 */
export function DailyVerifyCell({
  status,
  note,
  balance,
  pending,
  approved,
  canVerify,
  canDirectCorrect,
  allowNegative = false,
  onVerify,
}: {
  status: DailyVerifyStatus
  note: string | null
  balance: number
  pending?: PendingCorrection
  approved?: ApprovedCorrection
  canVerify: boolean
  canDirectCorrect?: boolean
  /**
   * Angka pengganti boleh minus. Dinyalakan oleh grid Bank: rekening bisa
   * overdraft/kartu kredit, jadi saldo negatif adalah keadaan yang sah — dan
   * koreksinya harus bisa mencapai keadaan itu. Grid stock & kas tetap `false`:
   * kuantitas fisik dan uang tunai di tangan tidak bisa kurang dari nol.
   */
  allowNegative?: boolean
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
        <Badge variant="outline" className="w-fit gap-1 border-warning/50 text-warning">
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
      <div className="flex flex-col gap-0.5">
        <Badge variant="outline" className="w-fit gap-1 border-success/50 text-success">
          <IconCheck className="size-3" />
          Sesuai
        </Badge>
        {approved && <CorrectedTag approved={approved} />}
      </div>
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
              <p className="text-sm font-medium">
                {canDirectCorrect ? "Koreksi saldo" : "Ajukan koreksi"}
              </p>
              <p className="text-xs text-muted-foreground">
                Tersimpan: Rp {fmt(balance)}.{" "}
                {canDirectCorrect
                  ? "Angka pengganti langsung berlaku — tetap tercatat di riwayat koreksi."
                  : "Angka pengganti baru berlaku setelah disetujui Owner / Super Admin."}
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
                allowNegative={allowNegative}
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
                {submitting ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : canDirectCorrect ? (
                  "Simpan koreksi"
                ) : (
                  "Ajukan"
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
