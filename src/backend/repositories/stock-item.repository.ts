import prisma from '@/lib/prisma'
import { StockItemType } from '@src/generated/prisma/client'

export const stockItemRepository = {
  findByBranch(branchId: string, onlyActive = true) {
    return prisma.stockItem.findMany({
      where: { branchId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    })
  },

  findById(id: string) {
    return prisma.stockItem.findUnique({ where: { id } })
  },

  create(data: {
    branchId: string
    name: string
    code?: string | null
    type?: StockItemType
    sortOrder?: number
  }) {
    return prisma.stockItem.create({ data })
  },

  update(id: string, data: Partial<{ name: string; code: string | null; type: StockItemType; sortOrder: number; isActive: boolean }>) {
    return prisma.stockItem.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.stockItem.delete({ where: { id } })
  },
}
