import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { companyStockItemRepository } from '@/backend/repositories/company-stock-item.repository'
import { ok } from '@/backend/helpers/api-response'
import { handleError } from '@/backend/helpers/handle-error'
import { requirePermission } from '@/backend/helpers/get-admin-caller'
import { withValidation } from '@/backend/middleware/with-validation'
import { PERMISSIONS } from '@/lib/permissions'
import { assertCompanyAccess } from '@/backend/services/stockist.service'

const createSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1).max(100),
  code: z.string().max(10).optional(),
  type: z.enum(['CURRENCY', 'LOGAM_MULIA']).default('CURRENCY'),
  sortOrder: z.number().int().default(0),
})

type CreateBody = z.infer<typeof createSchema>

// GET /api/company-stock-items?companyId=X — list stok mata uang & logam mulia milik 1 PT
export async function GET(req: NextRequest) {
  try {
    const caller = await requirePermission(PERMISSIONS.COMPANY_STOCK_VIEW)
    if (caller instanceof NextResponse) return caller

    const companyId = req.nextUrl.searchParams.get('companyId')
    if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    assertCompanyAccess(caller, companyId)

    const onlyActive = req.nextUrl.searchParams.get('active') !== 'false'
    const items = await companyStockItemRepository.findByCompany(companyId, onlyActive)
    return NextResponse.json(ok(items))
  } catch (e) {
    return handleError(e)
  }
}

export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const caller = await requirePermission(PERMISSIONS.COMPANY_STOCK_MANAGE)
      if (caller instanceof NextResponse) return caller
      assertCompanyAccess(caller, ctx.body.companyId)

      const item = await companyStockItemRepository.create(ctx.body)
      return NextResponse.json(ok(item, 'Stock item created'), { status: 201 })
    } catch (e) {
      return handleError(e)
    }
  }
)
