// KPI pelayanan nasabah & kondisi tempat pelayanan.

import type { KpiSeed } from '../types'

export const LAYANAN_KPIS: KpiSeed[] = [
  {
    code: 'complain-nasabah',
    name: 'Complain Nasabah',
    description: '3 poin minus setiap ada komplain nasabah.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
  },
  {
    code: 'kepuasan-nasabah',
    name: 'Kepuasan Nasabah (Survey)',
    objective: 'Meningkatkan pelayanan kepada nasabah dan menaikkan omzet',
    description: '1 poin setiap survey terkumpul, target 100 survey per bulan.',
    scoringType: 'REWARD_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
    defaultRequiresEvidence: true,
  },
  {
    code: 'kepuasan-pelanggan-review',
    name: 'Kepuasan Pelanggan (Google Review)',
    objective: 'Meningkatkan pelayanan kepada customer',
    description: '1 Google review ulasan bagus = +2 poin, target 50 poin.',
    scoringType: 'REWARD_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SELF',
    defaultRequiresApproval: true,
    defaultRequiresEvidence: true,
  },
  {
    code: 'kebersihan-booth',
    name: 'Kebersihan & Kerapihan Booth',
    description: 'Minus 5 poin setiap tempat yang tidak bagus.',
    scoringType: 'PENALTY_POINT',
    unit: 'OCCURRENCE',
    defaultInputSource: 'SUPERVISOR',
    defaultRequiresApproval: false,
    defaultRequiresEvidence: true,
  },
]
