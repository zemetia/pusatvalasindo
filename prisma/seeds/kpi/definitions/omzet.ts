// KPI omzet & profitabilitas.

import type { KpiSeed } from '../types'

export const OMZET_KPIS: KpiSeed[] = [
  {
    code: 'jumlah-omzet',
    name: 'Jumlah Omzet',
    objective: 'Meningkatkan pelayanan kepada nasabah dan menaikkan omzet',
    description: 'Total omzet yang dibukukan dalam satu bulan dibandingkan target jabatan.',
    scoringType: 'TARGET_VALUE',
    unit: 'CURRENCY',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
    defaultRequiresEvidence: true,
  },
  {
    code: 'net-profit-margin',
    name: 'Net Profit Margin',
    objective: 'Memastikan resiko likuiditas minimal dan stok mata uang terjaga',
    description: 'Margin laba bersih bulan berjalan dibandingkan target.',
    scoringType: 'TARGET_VALUE',
    unit: 'CURRENCY',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
]
