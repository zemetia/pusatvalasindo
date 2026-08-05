import type { Prisma } from '../../../src/generated/prisma/client'

export type RoleKpiSeed = {
  kpi: string // KpiDefinition.code
  weight: number
  targetValue?: number
  basePoint?: number
  pointPerUnit?: number
  toleranceLimit?: number
  toleranceScope?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  /** Override kebijakan pengisian khusus jabatan ini (null = ikut definisi). */
  inputSource?: 'SELF' | 'SUPERVISOR' | 'SYSTEM'
  /** Parameter kolektor otomatis; lihat src/lib/kpi-collectors.ts. */
  systemConfig?: Prisma.InputJsonObject
}

export type CompanyCode = 'PVI' | 'PTU' | 'PKD'

export type RoleBlock = {
  company: CompanyCode
  role: string // custom_role.name
  kpis: RoleKpiSeed[]
}
