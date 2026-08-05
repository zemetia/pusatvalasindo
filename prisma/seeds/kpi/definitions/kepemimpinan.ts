// KPI kepemimpinan tim (jabatan kepala).

import type { KpiSeed } from '../types'

export const KEPEMIMPINAN_KPIS: KpiSeed[] = [
  {
    code: 'score-okr-tim-kurir',
    name: 'Score OKR Tim Kurir',
    objective: 'Memastikan kinerja tim kurir di bawah koordinasinya',
    description:
      'Rata-rata pencapaian KPI tim kurir pada periode yang sama, dalam persen (100 = seluruh target tim tercapai).',
    scoringType: 'TARGET_VALUE',
    unit: 'PERCENT',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'team-management',
    name: 'Team Management',
    description: 'Target 10 briefing tim per bulan.',
    scoringType: 'TARGET_VALUE',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
  },
]
