import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stockItemRepository } from '@/backend/repositories/stock-item.repository'
import { ok } from '@/backend/helpers/api-response'
import { handleError } from '@/backend/helpers/handle-error'
import { withValidation } from '@/backend/middleware/with-validation'
import { NotFoundError } from '@/backend/errors/app-error'
import { requirePermission } from '@/backend/helpers/get-admin-caller'
import { PERMISSIONS } from '@/lib/permissions'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(10).nullable().optional(),
  type: z.enum(['CURRENCY', 'GOLD', 'CASH']).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }
type UpdateBody = z.infer<typeof updateSchema>

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCK_VIEW)
    if (caller instanceof NextResponse) return caller

    const { id } = await params
    const item = await stockItemRepository.findById(id)
    if (!item) throw new NotFoundError('Stock item not found')
    return NextResponse.json(ok(item))
  } catch (e) {
    return handleError(e)
  }
}

export const PUT = withValidation(updateSchema)(
  async (_req: NextRequest, ctx: Params & { body: UpdateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCK_MANAGE)
      if (caller instanceof NextResponse) return caller

      const { id } = await ctx.params
      const item = await stockItemRepository.update(id, ctx.body)
      return NextResponse.json(ok(item, 'Stock item updated'))
    } catch (e) {
      return handleError(e)
    }
  }
)

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCK_MANAGE)
    if (caller instanceof NextResponse) return caller

    const { id } = await params
    await stockItemRepository.softDelete(id)
    return NextResponse.json(ok(null, 'Stock item deactivated'))
  } catch (e) {
    return handleError(e)
  }
}
