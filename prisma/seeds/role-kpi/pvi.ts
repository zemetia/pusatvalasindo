// PT PUSAT VALAS INDO — penerapan KPI per jabatan.
// Angka berasal dari sheet KPI PVI (docs/PVI Data/PUSAT KPI SEMUA_.xlsx).

import { CLOSING, SOP_PENALTY, TEAM_MANAGEMENT } from './shared'
import type { RoleBlock } from './types'

export const PVI_ROLE_KPIS: RoleBlock[] = [
  {
    company: 'PVI',
    role: 'Marketing',
    kpis: [
      { kpi: 'jumlah-omzet', weight: 0.3, targetValue: 700_000_000 },
      { kpi: 'complain-nasabah', weight: 0.15, basePoint: 100, pointPerUnit: 3 },
      SOP_PENALTY(0.2, 2),
      { kpi: 'laporan-rekonsiliasi-tepat-waktu', weight: 0.15, basePoint: 100, pointPerUnit: 2 },
      { kpi: 'laporan-compliance-tepat-waktu', weight: 0.1, basePoint: 100, pointPerUnit: 4 },
      { kpi: 'kepuasan-nasabah', weight: 0.1, targetValue: 100, pointPerUnit: 1 },
    ],
  },
  {
    company: 'PVI',
    role: 'Teller Luar',
    kpis: [
      { kpi: 'jumlah-omzet', weight: 0.35, targetValue: 10_000_000_000 },
      { kpi: 'ketelitian-perhitungan', weight: 0.1, basePoint: 100, pointPerUnit: 3 },
      SOP_PENALTY(0.15, 3),
      { kpi: 'kepuasan-pelanggan-review', weight: 0.3, targetValue: 50, pointPerUnit: 2 },
      { kpi: 'kebersihan-booth', weight: 0.1, basePoint: 100, pointPerUnit: 5 },
    ],
  },
  {
    company: 'PVI',
    role: 'Teller Dalam',
    kpis: [
      CLOSING(0.45, '05:15'),
      { kpi: 'checklist-in-out', weight: 0.2 },
      {
        kpi: 'kesesuaian-jumlah-kas',
        weight: 0.35,
        basePoint: 100,
        pointPerUnit: 4,
        toleranceLimit: 100_000,
        toleranceScope: 'DAILY',
      },
    ],
  },
  {
    company: 'PVI',
    role: 'Kurir',
    kpis: [
      { kpi: 'ketepatan-pengiriman', weight: 0.7, targetValue: 900 },
      { kpi: 'serah-terima-barang-tepat-waktu', weight: 0.2, basePoint: 100, pointPerUnit: 4 },
      SOP_PENALTY(0.1, 4),
    ],
  },
  {
    company: 'PVI',
    role: 'Kepala Marketing',
    kpis: [
      { kpi: 'net-profit-margin', weight: 0.4, targetValue: 700_000_000 },
      // Sheet PVI menulis 0,2 sehingga totalnya cuma 95%, padahal baris subtotal
      // di sheet yang sama berbunyi 1,0. Disamakan dengan PTU (0,25) agar genap.
      { kpi: 'ketersediaan-stok-mata-uang', weight: 0.25, pointPerUnit: 5 },
      { kpi: 'complain-nasabah', weight: 0.15, basePoint: 100, pointPerUnit: 5 },
      { kpi: 'update-kurs', weight: 0.1, pointPerUnit: 5 },
      TEAM_MANAGEMENT,
    ],
  },
  {
    company: 'PVI',
    role: 'Kepala Cabang',
    kpis: [
      // Bobot omzet diturunkan dari 0,4 ke 0,3 untuk memberi ruang Team
      // Management — lihat CATATAN BOBOT KEPALA CABANG di shared.ts.
      { kpi: 'jumlah-omzet', weight: 0.3, targetValue: 700_000_000_000 },
      { kpi: 'kepatuhan-regulasi-sop', weight: 0.25, pointPerUnit: 5 },
      { kpi: 'resiko-likuiditas', weight: 0.2, pointPerUnit: 5 },
      { kpi: 'efisiensi-pelaporan-monitoring-kurs', weight: 0.15, pointPerUnit: 5 },
      TEAM_MANAGEMENT,
    ],
  },
]
