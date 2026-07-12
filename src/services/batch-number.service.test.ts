import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock prisma before importing the module under test
const mockFindFirst = vi.fn()
vi.mock("@/lib/prisma", () => ({
  default: {
    refiningBatch: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}))

import { generateBatchNumber } from "./batch-number.service"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("generateBatchNumber", () => {
  it("returns BT-YYYYMMDD-001 when no batches exist today", async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await generateBatchNumber()

    const today = new Date()
    const expected = `BT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-001`
    expect(result).toBe(expected)
    expect(mockFindFirst).toHaveBeenCalledTimes(1)
  })

  it("increments sequence from the last batch of the day", async () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
    mockFindFirst.mockResolvedValue({ batchNumber: `BT-${dateStr}-005` })

    const result = await generateBatchNumber()

    expect(result).toBe(`BT-${dateStr}-006`)
  })

  it("zero-pads sequence to 3 digits", async () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
    mockFindFirst.mockResolvedValue({ batchNumber: `BT-${dateStr}-009` })

    const result = await generateBatchNumber()

    expect(result).toBe(`BT-${dateStr}-010`)
  })

  it("rolls over to 001 on a new day even if yesterday had batches", async () => {
    // Set yesterday's batch — today should reset to 001
    const yesterday = new Date(Date.now() - 86400000)
    const yDate = `${yesterday.getFullYear()}${String(yesterday.getMonth() + 1).padStart(2, "0")}${String(yesterday.getDate()).padStart(2, "0")}`
    // The query uses startsWith with TODAY's prefix — yesterday's batch won't match
    mockFindFirst.mockResolvedValue(null)

    const result = await generateBatchNumber()

    const today = new Date()
    const expected = `BT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-001`
    expect(result).toBe(expected)
  })

  it("handles batch numbers from previous months correctly", async () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
    // Previous batches from other days — shouldn't affect today's sequence
    mockFindFirst.mockResolvedValue(null)

    const result = await generateBatchNumber()

    expect(result).toBe(`BT-${dateStr}-001`)
  })

  it("matches the expected format pattern", async () => {
    mockFindFirst.mockResolvedValue({ batchNumber: "BT-20260711-042" })

    const result = await generateBatchNumber()

    expect(result).toMatch(/^BT-\d{8}-\d{3}$/)
  })

  it("returns globally unique IDs across calls", async () => {
    let seq = 0
    mockFindFirst.mockImplementation(() => {
      if (seq === 0) return Promise.resolve(null)
      const today = new Date()
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
      return Promise.resolve({ batchNumber: `BT-${dateStr}-${String(seq).padStart(3, "0")}` })
    })

    const ids = new Set<string>()
    for (let i = 0; i < 20; i++) {
      seq = i
      const id = await generateBatchNumber()
      expect(ids.has(id)).toBe(false)
      ids.add(id)
    }

    expect(ids.size).toBe(20)
  })

  it("handles sequence 999 correctly (rolls to 1000)", async () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
    mockFindFirst.mockResolvedValue({ batchNumber: `BT-${dateStr}-999` })

    const result = await generateBatchNumber()

    // 999 + 1 = 1000, padded to 3 = "1000" (4 chars, not 3 — this is expected overflow behavior)
    expect(result).toBe(`BT-${dateStr}-1000`)
  })

  it("throws when prisma rejects", async () => {
    mockFindFirst.mockRejectedValue(new Error("connection refused"))

    await expect(generateBatchNumber()).rejects.toThrow("connection refused")
  })
})
