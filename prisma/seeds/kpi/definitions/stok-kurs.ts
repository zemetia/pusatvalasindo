// KPI ketersediaan stok mata uang, kurs, dan likuiditas.

import type { KpiSeed } from '../types'

export const STOK_KURS_KPIS: KpiSeed[] = [
  {
    code: 'ketersediaan-stok-mata-uang',
    name: 'Ketersediaan Stok Mata Uang',
    description: 'Setiap kali customer datang dan stok tidak ada, minus 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'update-kurs',
    name: 'Update Kurs',
    description: 'Minus 5% setiap kali telat update kurs.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'resiko-likuiditas',
    name: 'Resiko Likuiditas',
    description: 'Setiap temuan resiko likuiditas dihitung 5%.',
    scoringType: 'PENALTY_PERCENT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
]
