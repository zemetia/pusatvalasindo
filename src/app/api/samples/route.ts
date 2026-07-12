import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { sampleRepository } from "@/backend/repositories/sample.repository"
import { generateSampleNumber } from "@/services/sample-number.service"
import { ok } from "@/backend/helpers/api-response"
import { handleError } from "@/backend/helpers/handle-error"
import { withValidation } from "@/backend/middleware/with-validation"

const createSchema = z.object({
  materialType: z.string().min(1).max(200),
  source: z.string().max(200).nullable().optional(),
  initialNotes: z.string().max(2000).nullable().optional(),
})

type CreateBody = z.infer<typeof createSchema>

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status") || undefined
    const search = req.nextUrl.searchParams.get("search") || undefined
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50")
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0")

    const samples = await sampleRepository.findAll({ status, search, limit, offset })
    return NextResponse.json(ok(samples))
  } catch (e) {
    return handleError(e)
  }
}

export const POST = withValidation(createSchema)(
  async (_req: NextRequest, ctx: { body: CreateBody }) => {
    try {
      const sampleNumber = await generateSampleNumber()
      const sample = await sampleRepository.create({
        materialType: ctx.body.materialType,
        source: ctx.body.source ?? null,
        initialNotes: ctx.body.initialNotes ?? null,
        sampleNumber,
      })
      return NextResponse.json(ok(sample, "Sample registered"), { status: 201 })
    } catch (e) {
      return handleError(e)
    }
  }
)
