// PT PUSAT KIRIM DUIT — penerapan KPI per jabatan.
//
// Versi Juli 2026 (docs/PVI Data/PUSAT KPI SEMUA_2.xlsx sheet PKD baris 3–21),
// bukan lagi PUSAT KPI SEMUA_.xlsx / PERHITUNGAN KOMISI KPI_.xlsx. Terjemahan
// lengkap beserta jejak selnya ada di docs/rules/pkd.md; matriks bonus yang
// memakai skor dari sini ada di prisma/seeds/payroll-rules/pkd.ts.
//
// Yang berubah dari versi sebelumnya:
//   * target omzet  85 M → 100 M untuk kedua jabatan
//   * Marketing     dua KPI laporan (0,15 + 0,1) digabung jadi satu (0,2) memakai
//                   definisi baru laporan-compliance-rekonsiliasi-tepat-waktu;
//                   complain 3 → 5 poin; SOP tetap 2 poin tapi bobot naik
//                   0,2 → 0,25; survey dari 1 poin/100 survey menjadi
//                   5 poin/20 survey
//   * Kepala Cabang net profit margin (0,35) DIHAPUS dan digantikan omzet tim;
//                   kepatuhan SOP turun 0,25 → 0,15; muncul TEAM MANAGEMENT
//                   (0,1) yang sebelumnya tidak ada

import { SOP_PENALTY, TEAM_MANAGEMENT } from './shared'
import type { RoleBlock } from './types'

export const PKD_ROLE_KPIS: RoleBlock[] = [
  {
    company: 'PKD',
    role: 'Marketing',
    kpis: [
      // Sheet menulis bobot omzet 0,4 sehingga totalnya jadi 110% — kelebihan
      // 0,1 itu persis sebesar kenaikan bobot omzet dari versi sebelumnya.
      // Diambil kembali dari omzet, mengikuti perlakuan yang sudah dipakai
      // untuk Kepala Cabang PVI & PTU (lihat catatan bobot di shared.ts): hanya
      // bobot itu yang cukup besar untuk menampungnya tanpa menghapus KPI lain.
      // Ini satu-satunya angka PKD yang bukan salinan langsung dari sheet
      // (PKD-D1 di docs/rules/pkd.md) — kalau manajemen memutuskan
      // potongannya diambil dari KPI lain, ubah baris ini dan baris yang
      // ditunjuk.
      { kpi: 'jumlah-omzet', weight: 0.3, targetValue: 100_000_000_000 },
      { kpi: 'complain-nasabah', weight: 0.15, basePoint: 100, pointPerUnit: 5 },
      SOP_PENALTY(0.25, 2),
      {
        kpi: 'laporan-compliance-rekonsiliasi-tepat-waktu',
        weight: 0.2,
        basePoint: 100,
        pointPerUnit: 5,
      },
      // 5 poin per survey dengan target 20 survey sebulan = 100 poin penuh.
      { kpi: 'kepuasan-nasabah', weight: 0.1, targetValue: 100, pointPerUnit: 5 },
    ],
  },
  {
    company: 'PKD',
    role: 'Kepala Cabang',
    kpis: [
      { kpi: 'jumlah-omzet', weight: 0.4, targetValue: 100_000_000_000 },
      { kpi: 'kepatuhan-regulasi-sop', weight: 0.15, pointPerUnit: 5 },
      { kpi: 'complain-nasabah', weight: 0.2, basePoint: 100, pointPerUnit: 5 },
      { kpi: 'efisiensi-pelaporan-monitoring', weight: 0.15, pointPerUnit: 5 },
      TEAM_MANAGEMENT,
    ],
  },
]
