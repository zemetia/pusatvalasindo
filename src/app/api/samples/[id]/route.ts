import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"
import { sampleRepository } from "@/backend/repositories/sample.repository"
import { ok } from "@/backend/helpers/api-response"
import { handleError } from "@/backend/helpers/handle-error"
import { NotFoundError } from "@/backend/errors/app-error"
import { requireAuth } from "@/backend/helpers/get-admin-caller"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const caller = await requireAuth()
    if (caller instanceof NextResponse) return caller

    const { id } = await params
    const sample = await sampleRepository.findById(id)
    if (!sample) throw new NotFoundError("Sample not found")
    return NextResponse.json(ok(sample))
  } catch (e) {
    return handleError(e)
  }
}
