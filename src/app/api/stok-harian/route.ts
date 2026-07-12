import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { dailyStockEntryRepository } from '@/backend/repositories/daily-stock-entry.repository'
import { ok } from '@/backend/helpers/api-response'
import { handleError } from '@/backend/helpers/handle-error'

const stockEntrySchema = z.object({
  stockItemId: z.string().min(1),
  qty1: z.number().default(0),
  qty2: z.number().default(0),
  closingQty: z.number(),
  rateIdr: z.number().nullable(),
  totalIdr: z.number().nullable(),
  note: z.string().optional().nullable(),
})

const saveSchema = z.object({
  branchId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stockEntries: z.array(stockEntrySchema),
})

// GET /api/stok-harian?branchId=X&date=YYYY-MM-DD
// Rekening bank sekarang di-input per PT lewat /api/bank-harian (tab Bank di Stockist), bukan di sini.
export async function GET(req: NextRequest) {
  try {
    const branchId = req.nextUrl.searchParams.get('branchId')
    const dateStr = req.nextUrl.searchParams.get('date')
    if (!branchId || !dateStr) {
      return NextResponse.json({ error: 'branchId and date required' }, { status: 400 })
    }
    const date = new Date(dateStr)
    const stockEntries = await dailyStockEntryRepository.findByBranchAndDate(branchId, date)
    return NextResponse.json(ok({ stockEntries }))
  } catch (e) {
    return handleError(e)
  }
}

// POST /api/stok-harian
export async function POST(req: NextRequest) {
  try {
    const body = saveSchema.parse(await req.json())
    const date = new Date(body.date)

    await dailyStockEntryRepository.upsertMany(
      body.stockEntries.map((e) => ({ ...e, date, qty1: e.qty1 ?? 0, qty2: e.qty2 ?? 0 }))
    )

    return NextResponse.json(ok(null, 'Data stok harian berhasil disimpan'))
  } catch (e) {
    return handleError(e)
  }
}
