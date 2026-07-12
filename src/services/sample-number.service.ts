import prisma from "@/lib/prisma"

export async function generateSampleNumber(): Promise<string> {
  const today = new Date()
  const y = today.getFullYear().toString()
  const m = String(today.getMonth() + 1).padStart(2, "0")
  const d = String(today.getDate()).padStart(2, "0")
  const dateStr = `${y}${m}${d}`
  const prefix = `GA-${dateStr}`

  const lastSample = await prisma.sample.findFirst({
    where: { sampleNumber: { startsWith: prefix } },
    orderBy: { sampleNumber: "desc" },
    select: { sampleNumber: true },
  })

  let seq = 1
  if (lastSample?.sampleNumber) {
    const parts = lastSample.sampleNumber.split("-")
    seq = parseInt(parts[2] || "0", 10) + 1
  }

  return `${prefix}-${String(seq).padStart(3, "0")}`
}
