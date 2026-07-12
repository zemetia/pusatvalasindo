import { NextRequest, NextResponse } from "next/server"
import { sampleRepository } from "@/backend/repositories/sample.repository"
import { generateSampleQRCodeSvg } from "@/services/qr.service"
import { ok } from "@/backend/helpers/api-response"
import { handleError } from "@/backend/helpers/handle-error"
import { NotFoundError } from "@/backend/errors/app-error"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const sample = await sampleRepository.findById(id)
    if (!sample) throw new NotFoundError("Sample not found")

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const qrSvg = await generateSampleQRCodeSvg(id, sample.sampleNumber, baseUrl)

    return NextResponse.json(
      ok({
        sample: {
          id: sample.id,
          sampleNumber: sample.sampleNumber,
          materialType: sample.materialType,
          source: sample.source,
          dateReceived: sample.dateReceived,
        },
        qrSvg,
        sampleUrl: `${baseUrl}/samples/${id}`,
      })
    )
  } catch (e) {
    return handleError(e)
  }
}
