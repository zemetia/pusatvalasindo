import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stockItemRepository } from '@/backend/repositories/stock-item.repository'
import { ok } from '@/backend/helpers/api-response'
import { handleError } from '@/backend/helpers/handle-error'
import { withValidation } from '@/backend/middleware/with-validation'
import { requirePermission } from '@/backend/helpers/get-admin-caller'
import { PERMISSIONS } from '@/lib/permissions'

const createSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(1).max(100),
  code: z.string().max(10).optional(),
  type: z.enum(['CURRENCY', 'GOLD', 'CASH']).default('CURRENCY'),
  sortOrder: z.number().int().default(0),
})

type CreateBody = z.infer<typeof createSchema>

export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.STOCK_VIEW)
    if (caller instanceof NextResponse) return caller

    const branchId = req.nextUrl.searchParams.get('branchId')
    if (!branchId) return NextResponse.json({ error: 'branchId required' }, { status: 400 })
    const onlyActive = req.nextUrl.searchParams.get('active') !== 'false'
    const items = await stockItemRepository.findByBranch(branchId, onlyActive)
    return NextResponse.json(ok(items))
  } catch (e) {
    return handleError(e)
  }
}

export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.STOCK_MANAGE)
      if (caller instanceof NextResponse) return caller

      const item = await stockItemRepository.create(ctx.body)
      return NextResponse.json(ok(item, 'Stock item created'), { status: 201 })
    } catch (e) {
      return handleError(e)
    }
  }
)
