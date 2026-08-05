// KPI kepatuhan SOP, pelaporan, dan pengarsipan.

import type { KpiSeed } from '../types'

export const KEPATUHAN_KPIS: KpiSeed[] = [
  {
    code: 'kesesuaian-sop',
    name: 'Kesesuaian SOP',
    description: '2 poin minus setiap kesalahan prosedur.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'laporan-rekonsiliasi-tepat-waktu',
    name: 'Laporan & Rekonsiliasi Tepat Waktu',
    description: 'Lewat dari jam 17.30 minus 2 poin.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'laporan-compliance-tepat-waktu',
    name: 'Laporan Compliance Tepat Waktu',
    description: '4 poin minus setiap kesalahan pelaporan LTKT/LTKM.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    // Sheet PKD versi Juli 2026 menggabungkan dua KPI di atas menjadi satu baris
    // berbobot 0,2 dengan sanksi tunggal 5% per keterlambatan. Dibuat sebagai
    // definisi tersendiri, bukan mengubah dua definisi lama, karena PVI masih
    // memakai keduanya secara terpisah dengan tarif poin yang berbeda.
    code: 'laporan-compliance-rekonsiliasi-tepat-waktu',
    name: 'Laporan Compliance & Hasil Rekonsiliasi Tepat Waktu',
    description: 'Setiap keterlambatan dikenakan potongan 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'kepatuhan-regulasi-sop',
    name: 'Kepatuhan Regulasi SOP',
    objective: 'Pengawasan operasional',
    description: 'Setiap temuan pengawasan operasional dihitung 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'efisiensi-pelaporan-monitoring',
    name: 'Efisiensi Pelaporan & Monitoring',
    description: 'Setiap temuan keterlambatan pelaporan/monitoring dihitung 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'efisiensi-pelaporan-monitoring-kurs',
    name: 'Efisiensi Pelaporan & Monitoring Kurs',
    description: 'Setiap temuan keterlambatan pelaporan/monitoring kurs dihitung 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'kesesuaian-pengarsipan-berkas',
    name: 'Kesesuaian Pengarsipan Berkas',
    description: '2 poin minus setiap berkas yang tidak diarsipkan sesuai ketentuan.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
]
