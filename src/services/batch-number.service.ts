import prisma from "@/lib/prisma"

/**
 * Generate a globally unique, human-readable refining batch ID.
 *
 * Format: BT-YYYYMMDD-NNN
 *   BT        — batch prefix
 *   YYYYMMDD  — date of generation
 *   NNN        — zero-padded daily sequence (001–999)
 *
 * Resets sequence per calendar day (up to 999 batches/day).
 *
 * Shared utility — import and call `await generateBatchNumber()` anywhere.
 * Caller is responsible for inserting the row with the returned ID.
 * If the insert hits a P2002 (unique constraint) due to a concurrent call,
 * re-invoke `generateBatchNumber()` to get the next available sequence.
 *
 * @example
 *   const batchId = await generateBatchNumber()
 *   try {
 *     await prisma.refiningBatch.create({ data: { batchNumber: batchId, ... } })
 *   } catch (err) {
 *     if (err.code === 'P2002') batchId = await generateBatchNumber()
 *     else throw err
 *   }
 */
export async function generateBatchNumber(): Promise<string> {
  const today = new Date()
  const y = today.getFullYear().toString()
  const m = String(today.getMonth() + 1).padStart(2, "0")
  const d = String(today.getDate()).padStart(2, "0")
  const dateStr = `${y}${m}${d}`
  const prefix = `BT-${dateStr}`

  const lastBatch = await prisma.refiningBatch.findFirst({
    where: { batchNumber: { startsWith: prefix } },
    orderBy: { batchNumber: "desc" },
    select: { batchNumber: true },
  })

  let seq = 1
  if (lastBatch?.batchNumber) {
    const parts = lastBatch.batchNumber.split("-")
    seq = parseInt(parts[2] || "0", 10) + 1
  }

  return `${prefix}-${String(seq).padStart(3, "0")}`
}
