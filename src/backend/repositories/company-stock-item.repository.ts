import prisma from '@/lib/prisma'
import type { CompanyStockItemType } from '@src/generated/prisma/client'

export const companyStockItemRepository = {
  findByCompany(companyId: string, onlyActive = true) {
    return prisma.companyStockItem.findMany({
      where: { companyId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    })
  },

  findByCompanyAndType(companyId: string, type: CompanyStockItemType, onlyActive = true) {
    return prisma.companyStockItem.findMany({
      where: { companyId, type, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  },

  findById(id: string) {
    return prisma.companyStockItem.findUnique({ where: { id } })
  },

  create(data: {
    companyId: string
    name: string
    code?: string | null
    type?: CompanyStockItemType
    sortOrder?: number
  }) {
    return prisma.companyStockItem.create({ data })
  },

  update(id: string, data: Partial<{ name: string; code: string | null; type: CompanyStockItemType; sortOrder: number; isActive: boolean }>) {
    return prisma.companyStockItem.update({ where: { id }, data })
  },

  softDelete(id: string) {
    return prisma.companyStockItem.update({ where: { id }, data: { isActive: false } })
  },
}
