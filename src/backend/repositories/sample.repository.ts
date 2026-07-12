import prisma from "@/lib/prisma"

export type CreateSampleInput = {
  materialType: string
  source?: string | null
  initialNotes?: string | null
}

export type UpdateSampleInput = Partial<{
  materialType: string
  source: string | null
  initialNotes: string | null
  status: "RECEIVED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED"
  technicianId: string | null
  method: "FIRE_ASSAY" | "XRF" | "ICP" | null
  assayResults: string | null
}>

export const sampleRepository = {
  findAll(params?: {
    status?: string
    search?: string
    limit?: number
    offset?: number
  }) {
    const { status, search, limit = 50, offset = 0 } = params ?? {}
    return prisma.sample.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(search
          ? {
              OR: [
                { sampleNumber: { contains: search, mode: "insensitive" as any } },
                { materialType: { contains: search, mode: "insensitive" as any } },
                { source: { contains: search, mode: "insensitive" as any } },
              ],
            }
          : {}),
      },
      include: { technician: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    })
  },

  findById(id: string) {
    return prisma.sample.findUnique({
      where: { id },
      include: { technician: { select: { id: true, name: true } } },
    })
  },

  findBySampleNumber(sampleNumber: string) {
    return prisma.sample.findUnique({
      where: { sampleNumber },
      include: { technician: { select: { id: true, name: true } } },
    })
  },

  create(data: CreateSampleInput & { sampleNumber: string }) {
    return prisma.sample.create({
      data,
      include: { technician: { select: { id: true, name: true } } },
    })
  },

  update(id: string, data: UpdateSampleInput) {
    return prisma.sample.update({
      where: { id },
      data: data as any,
      include: { technician: { select: { id: true, name: true } } },
    })
  },
}
