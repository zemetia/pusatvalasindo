// PT PUSAT TUKAR UANG — penerapan KPI per jabatan.
// Angka berasal dari sheet KPI PTU (docs/PVI Data/PUSAT KPI SEMUA_.xlsx).

import { CLOSING, SOP_PENALTY, TEAM_MANAGEMENT } from './shared'
import type { RoleBlock } from './types'

export const PTU_ROLE_KPIS: RoleBlock[] = [
  {
    company: 'PTU',
    role: 'Teller Luar',
    kpis: [
      { kpi: 'jumlah-omzet', weight: 0.35, targetValue: 85_000_000_000 },
      { kpi: 'ketelitian-perhitungan', weight: 0.1, basePoint: 100, pointPerUnit: 3 },
      SOP_PENALTY(0.15, 3),
      { kpi: 'kepuasan-pelanggan-review', weight: 0.3, targetValue: 50, pointPerUnit: 2 },
      { kpi: 'kebersihan-booth', weight: 0.1, basePoint: 100, pointPerUnit: 5 },
    ],
  },
  {
    company: 'PTU',
    role: 'Teller Dalam',
    kpis: [
      CLOSING(0.45, '05:00'),
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
    company: 'PTU',
    role: 'Kurir',
    kpis: [
      { kpi: 'ketepatan-pengiriman', weight: 0.7, targetValue: 900 },
      { kpi: 'serah-terima-barang-tepat-waktu', weight: 0.2, basePoint: 100, pointPerUnit: 4 },
      SOP_PENALTY(0.1, 4),
    ],
  },
  {
    company: 'PTU',
    role: 'Kepala Marketing',
    kpis: [
      { kpi: 'net-profit-margin', weight: 0.4, targetValue: 85_000_000_000 },
      { kpi: 'ketersediaan-stok-mata-uang', weight: 0.25, pointPerUnit: 5 },
      // Dua KPI ini ada di sheet PTU tapi belum pernah ikut ter-seed, itulah
      // sebabnya jabatan ini sempat cuma berbobot 65%.
      { kpi: 'score-okr-tim-kurir', weight: 0.2, targetValue: 100 },
      { kpi: 'resiko-likuiditas', weight: 0.15, pointPerUnit: 5 },
    ],
  },
  {
    company: 'PTU',
    role: 'Kepala Cabang',
    kpis: [
      // Sama seperti Kepala Cabang PVI: omzet memberi ruang 10% untuk Team
      // Management — lihat CATATAN BOBOT KEPALA CABANG di shared.ts.
      { kpi: 'jumlah-omzet', weight: 0.3, targetValue: 85_000_000_000 },
      { kpi: 'kepatuhan-regulasi-sop', weight: 0.25, pointPerUnit: 5 },
      { kpi: 'complain-nasabah', weight: 0.2, basePoint: 100, pointPerUnit: 5 },
      { kpi: 'efisiensi-pelaporan-monitoring', weight: 0.15, pointPerUnit: 5 },
      TEAM_MANAGEMENT,
    ],
  },
]
