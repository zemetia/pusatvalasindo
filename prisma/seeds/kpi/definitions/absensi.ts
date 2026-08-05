// KPI yang datanya ditarik dari modul absensi.

import type { KpiSeed } from '../types'

export const ABSENSI_KPIS: KpiSeed[] = [
  {
    code: 'kehadiran-kedisiplinan',
    name: 'Kehadiran & Kedisiplinan',
    description:
      'Keterlambatan & ketidakhadiran. Diambil otomatis dari modul absensi — tidak diisi manual.',
    scoringType: 'PENALTY_POINT',
    unit: 'DAY',
    defaultInputSource: 'SYSTEM',
    defaultRequiresApproval: false,
    systemSourceKey: 'ATTENDANCE_LATE',
  },
]
