"use client"

import { useCallback, useEffect, useState } from "react"
import { IconCheck } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

/** Ringkasan cross-check satu PT satu tanggal — bentuknya sama untuk kas dan bank. */
export type HeadConfirmationMatch = {
  /** Total sistem versi server (dari entri yang sudah tersimpan). */
  systemTotal: number
  /** Angka hitung ulang kepala cabang; null kalau cross-check-nya belum diisi. */
  confirmedIdrValue: number | null
  isMatch: boolean
  /** Jam klop tersimpan; null selama belum klop. */
  matchedAt: string | null
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 })
}

function fmtTime(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

/**
 * Membaca ringkasan cross-check untuk grid harian. Endpoint-nya sekaligus menandai
 * klop dan menyimpan jamnya di server, jadi `refresh()` dipanggil ulang setiap kali
 * saldo di grid berubah — di situlah selisihnya bisa tertutup.
 *
 * Kegagalan sengaja tidak memunculkan toast: ini info pelengkap di bawah grid, bukan
 * data utama halamannya.
 */
export function useHeadConfirmationMatch(
  kind: "kas" | "bank",
  companyId: string,
  date: string
) {
  const [match, setMatch] = useState<HeadConfirmationMatch | null>(null)

  const refresh = useCallback(async () => {
    if (!companyId || !date) return
    try {
      const res = await fetch(
        `/api/stockist/head-confirmation/match?kind=${kind}&companyId=${companyId}&date=${date}`
      )
      const data = await res.json()
      setMatch(res.ok && data.success ? (data.data as HeadConfirmationMatch) : null)
    } catch {
      setMatch(null)
    }
  }, [kind, companyId, date])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { match, refresh }
}

/**
 * Baris info di bawah grid kas / bank harian: total yang dijumlah otomatis dari grid
 * ini vs total hitung ulang kepala cabang di halaman Cross-Check.
 *
 * Status klopnya dinilai dari `localTotal` (angka yang sedang tampil di grid), bukan
 * dari `match.isMatch` — supaya hasil edit langsung terasa. Tapi JAM-nya selalu jam
 * yang tersimpan di server: jam klop harus jam yang tercatat, bukan jam layar.
 */
export function HeadConfirmationSummary({
  label,
  localTotal,
  match,
}: {
  /** "kas" / "bank harian" — dipakai di kalimat status. */
  label: string
  localTotal: number
  match: HeadConfirmationMatch | null
}) {
  const confirmed = match?.confirmedIdrValue ?? null
  const isKlop = confirmed !== null && confirmed === localTotal
  const jamKlop = isKlop ? fmtTime(match?.matchedAt ?? null) : null
  const selisih = confirmed === null ? null : confirmed - localTotal

  return (
    <div className="flex flex-wrap items-end gap-x-10 gap-y-4 border-t pt-4">
      <Block label={`Total ${label} (otomatis)`} value={`Rp ${fmt(localTotal)}`} />
      <Block
        label="Total Kepala Cabang"
        value={confirmed === null ? "—" : `Rp ${fmt(confirmed)}`}
        muted={confirmed === null}
      />
      <div className="grid gap-1">
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
          Cross-Check
        </span>
        {confirmed === null ? (
          <span className="text-muted-foreground text-sm">Belum diisi kepala cabang</span>
        ) : isKlop ? (
          <span className="text-success flex items-center gap-1.5 text-sm font-semibold">
            <IconCheck className="size-4" />
            Klop{jamKlop ? ` — ${jamKlop}` : ""}
          </span>
        ) : (
          <span className="text-destructive tabular text-sm font-semibold">
            Selisih Rp {fmt(selisih ?? 0)}
          </span>
        )}
      </div>
    </div>
  )
}

/** Total IDR final seluruh stock hasil hitung ulang kepala cabang (halaman Cross-Check). */
export type StockHeadTotal = {
  confirmedIdrValue: number | null
  confirmedAt: string | null
}

export function useStockHeadTotal(companyId: string, date: string) {
  const [total, setTotal] = useState<StockHeadTotal | null>(null)

  useEffect(() => {
    let alive = true
    if (!companyId || !date) return
    ;(async () => {
      try {
        const res = await fetch(
          `/api/stockist/head-confirmation/match?kind=stock&companyId=${companyId}&date=${date}`
        )
        const data = await res.json()
        if (alive) setTotal(res.ok && data.success ? (data.data as StockHeadTotal) : null)
      } catch {
        if (alive) setTotal(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [companyId, date])

  return total
}

/**
 * Info total kepala cabang di kartu Stock. Angkanya tidak punya pembanding otomatis —
 * kepala cabang mengisi satu total IDR final untuk seluruh stock — jadi yang ditampilkan
 * hanya angkanya dan jam pengisiannya, bukan status klop.
 */
export function StockHeadTotalSummary({ total }: { total: StockHeadTotal | null }) {
  const confirmed = total?.confirmedIdrValue ?? null
  const jam = fmtTime(total?.confirmedAt ?? null)

  return (
    <div className="flex flex-wrap items-end gap-x-10 gap-y-4 border-t pt-4">
      <Block
        label="Total Stock — Kepala Cabang (IDR)"
        value={confirmed === null ? "—" : `Rp ${fmt(confirmed)}`}
        muted={confirmed === null}
      />
      <div className="grid gap-1">
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
          Jam Konfirmasi
        </span>
        <span className="text-muted-foreground text-sm">
          {confirmed === null ? "Belum diisi di halaman Cross-Check" : (jam ?? "—")}
        </span>
      </div>
    </div>
  )
}

function Block({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {label}
      </span>
      <span
        className={cn(
          "tabular font-mono text-lg font-semibold",
          muted && "text-muted-foreground font-normal"
        )}
      >
        {value}
      </span>
    </div>
  )
}
