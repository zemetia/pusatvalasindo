import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { companyStockItemRepository } from '@/backend/repositories/company-stock-item.repository'
import { ok } from '@/backend/helpers/api-response'
import { handleError } from '@/backend/helpers/handle-error'
import { withValidation } from '@/backend/middleware/with-validation'
import { requirePermission } from '@/backend/helpers/get-admin-caller'
import { PERMISSIONS } from '@/lib/permissions'
import { assertCompanyAccess } from '@/backend/services/stockist.service'
import { NotFoundError } from '@/backend/errors/app-error'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(10).nullable().optional(),
  type: z.enum(['CURRENCY', 'LOGAM_MULIA']).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }
type UpdateBody = z.infer<typeof updateSchema>

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.COMPANY_STOCK_VIEW)
    if (caller instanceof NextResponse) return caller

    const { id } = await params
    const item = await companyStockItemRepository.findById(id)
    if (!item) throw new NotFoundError('Stock item not found')
    assertCompanyAccess(caller, item.companyId)

    return NextResponse.json(ok(item))
  } catch (e) {
    return handleError(e)
  }
}

export const PUT = withValidation(updateSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.COMPANY_STOCK_MANAGE)
      if (caller instanceof NextResponse) return caller

      const { id } = await ctx.params
      const existing = await companyStockItemRepository.findById(id)
      if (!existing) throw new NotFoundError('Stock item not found')
      assertCompanyAccess(caller, existing.companyId)

      const item = await companyStockItemRepository.update(id, ctx.body)
      return NextResponse.json(ok(item, 'Stock item updated'))
    } catch (e) {
      return handleError(e)
    }
  }
)

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.COMPANY_STOCK_MANAGE)
    if (caller instanceof NextResponse) return caller

    const { id } = await params
    const existing = await companyStockItemRepository.findById(id)
    if (!existing) throw new NotFoundError('Stock item not found')
    assertCompanyAccess(caller, existing.companyId)

    await companyStockItemRepository.softDelete(id)
    return NextResponse.json(ok(null, 'Stock item deactivated'))
  } catch (e) {
    return handleError(e)
  }
}
