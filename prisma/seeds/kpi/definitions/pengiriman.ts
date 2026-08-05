// KPI pengiriman & serah terima (jabatan kurir).

import type { KpiSeed } from '../types'

export const PENGIRIMAN_KPIS: KpiSeed[] = [
  {
    code: 'ketepatan-pengiriman',
    name: 'Ketepatan Waktu & Jumlah Pengiriman',
    objective: 'Memastikan pengiriman on time & customer happy',
    description: 'Jumlah pengiriman tepat waktu dibandingkan target bulanan.',
    scoringType: 'TARGET_VALUE',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
    defaultRequiresEvidence: true,
  },
  {
    code: 'serah-terima-barang-tepat-waktu',
    name: 'Laporan Serah Terima Barang Tepat Waktu',
    description: 'Setiap kesalahan laporan serah terima dikenakan 4 poin minus.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
]
