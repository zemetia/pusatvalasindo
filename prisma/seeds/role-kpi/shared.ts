// Parameter yang dipakai berulang antar PT, supaya perubahan aturan cukup di
// satu tempat dan tidak perlu diubah di tiga file PT sekaligus.

import type { RoleKpiSeed } from './types'

/**
 * Closing tepat waktu ditarik dari jam absen pulang. Batas jamnya berbeda antar
 * PT — sheet KPI menulis 05.15 untuk PVI dan 05.00 untuk PTU — dengan toleransi
 * 1 jam ("BATAS MAKSIMAL 1 JAM SETELAH ...").
 */
export const CLOSING = (weight: number, deadline: string): RoleKpiSeed => ({
  kpi: 'closing-tepat-waktu',
  weight,
  basePoint: 100,
  pointPerUnit: 4,
  systemConfig: { deadline, graceMinutes: 60 },
})

export const SOP_PENALTY = (weight: number, point: number): RoleKpiSeed => ({
  kpi: 'kesesuaian-sop',
  weight,
  basePoint: 100,
  pointPerUnit: point,
})

export const TEAM_MANAGEMENT: RoleKpiSeed = {
  kpi: 'team-management',
  weight: 0.1,
  targetValue: 10, // 10 briefing per bulan
}

// ═══════════════════════════════════════════════════════════════════════════
// CATATAN BOBOT KEPALA CABANG (PVI & PTU) — dirujuk dari blok Kepala Cabang
// di pvi.ts dan ptu.ts.
//
// Di sheet, empat KPI intinya berjumlah tepat 1,0 (0,4 + 0,25 + 0,2 + 0,15) dan
// baris subtotalnya memang berbunyi 1,0 — tapi baris TEAM MANAGEMENT (0,1)
// ditulis DI BAWAH rentang rumus subtotal itu, sehingga totalnya jadi 110%
// tanpa disadari. Kepala Cabang PKD punya empat KPI inti yang sama tanpa Team
// Management dan berjumlah pas 100%, jadi Team Management memang tambahan yang
// lupa diimbangi.
//
// Di seed ini 10% itu diambil dari `jumlah-omzet` (0,4 → 0,3) karena hanya bobot
// itu yang cukup besar untuk menampungnya tanpa menghapus KPI lain. Ini satu-
// satunya angka yang bukan salinan langsung dari sheet — kalau manajemen ingin
// 10% itu diambil dari KPI lain, cukup ubah dua baris `jumlah-omzet` di blok
// Kepala Cabang pada pvi.ts dan ptu.ts.
// ═══════════════════════════════════════════════════════════════════════════
