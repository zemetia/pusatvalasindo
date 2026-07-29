import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    company: { findMany: vi.fn() },
    companyStockItem: { findMany: vi.fn() },
  },
}));

vi.mock("../repositories/finance-report.repository", () => ({
  financeReportRepository: {
    confirmationsInRange: vi.fn(),
    openingPositions: vi.fn(),
    systemSumsInRange: vi.fn(),
    qualityCounts: vi.fn(),
    closingStockQuantities: vi.fn(),
  },
}));

import prisma from "@/lib/prisma";
import { resolvePeriod } from "@/lib/finance-period";
import { financeReportService } from "./finance-report.service";
import { financeReportRepository } from "../repositories/finance-report.repository";

/**
 * Yang diuji di sini adalah bagian yang paling mudah salah dan paling mahal
 * kalau salah: carry-forward saldo, posisi awal vs posisi akhir, dan
 * konsolidasi lintas PT. Query-nya sendiri diuji lewat DB, bukan di sini.
 */

const RANGE = resolvePeriod({
  preset: "custom",
  from: "2026-07-03",
  to: "2026-07-05",
  today: "2026-07-05",
});

type Companies = Awaited<ReturnType<typeof prisma.company.findMany>>;
type StockItems = Awaited<ReturnType<typeof prisma.companyStockItem.findMany>>;

function setup(overrides: {
  confirmations?: Awaited<ReturnType<typeof financeReportRepository.confirmationsInRange>>;
  openings?: Awaited<ReturnType<typeof financeReportRepository.openingPositions>>;
  systemSums?: Awaited<ReturnType<typeof financeReportRepository.systemSumsInRange>>;
  quality?: Awaited<ReturnType<typeof financeReportRepository.qualityCounts>>;
  stockQty?: Awaited<ReturnType<typeof financeReportRepository.closingStockQuantities>>;
}) {
  vi.mocked(prisma.company.findMany).mockResolvedValue([
    { id: "pvi", name: "Pusat Valas Indo", code: "PVI" },
    { id: "ptu", name: "Pusat Tukar Uang", code: "PTU" },
  ] as unknown as Companies);
  vi.mocked(prisma.companyStockItem.findMany).mockResolvedValue([] as unknown as StockItems);
  vi.mocked(financeReportRepository.confirmationsInRange).mockResolvedValue(
    overrides.confirmations ?? [],
  );
  vi.mocked(financeReportRepository.openingPositions).mockResolvedValue(overrides.openings ?? []);
  vi.mocked(financeReportRepository.systemSumsInRange).mockResolvedValue(
    overrides.systemSums ?? [],
  );
  vi.mocked(financeReportRepository.qualityCounts).mockResolvedValue(overrides.quality ?? []);
  vi.mocked(financeReportRepository.closingStockQuantities).mockResolvedValue(
    overrides.stockQty ?? [],
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("financeReportService.getReport()", () => {
  it("membawa maju saldo hari tanpa konfirmasi, bukan menganggapnya nol", async () => {
    setup({
      confirmations: [
        { kind: "STOCK", companyId: "pvi", date: "2026-07-03", amount: 100 },
        { kind: "KAS", companyId: "pvi", date: "2026-07-03", amount: 20 },
        { kind: "BANK", companyId: "pvi", date: "2026-07-03", amount: 30 },
        // 4 Juli tidak dikonfirmasi sama sekali; 5 Juli hanya banknya.
        { kind: "BANK", companyId: "pvi", date: "2026-07-05", amount: 50 },
      ],
    });

    const report = await financeReportService.getReport(["pvi", "ptu"], RANGE);
    const pvi = report.companies.find((c) => c.id === "pvi");

    expect(pvi?.series.map((point) => point.total)).toEqual([150, 150, 170]);
    expect(pvi?.series.map((point) => point.confirmed)).toEqual([true, false, true]);
    // Stock & kas tetap terbawa meski 5 Juli hanya bank yang dikonfirmasi.
    expect(pvi?.closing).toMatchObject({ stock: 100, kas: 20, bank: 50, total: 170 });
    expect(pvi?.confirmedDays).toBe(2);
  });

  it("memakai konfirmasi terakhir sebelum periode sebagai posisi awal", async () => {
    setup({
      openings: [
        // Sebelum periode pembanding (< 30 Juni) — jadi seed deret.
        { kind: "STOCK", companyId: "pvi", date: "2026-06-20", amount: 40 },
        { kind: "KAS", companyId: "pvi", date: "2026-06-20", amount: 10 },
      ],
      confirmations: [
        // Konfirmasi di periode pembanding menentukan posisi awal periode terpilih.
        { kind: "STOCK", companyId: "pvi", date: "2026-07-01", amount: 80 },
        { kind: "KAS", companyId: "pvi", date: "2026-07-01", amount: 20 },
        { kind: "STOCK", companyId: "pvi", date: "2026-07-05", amount: 120 },
      ],
    });

    const report = await financeReportService.getReport(["pvi", "ptu"], RANGE);
    const pvi = report.companies.find((c) => c.id === "pvi");

    expect(pvi?.opening.total).toBe(100); // 80 + 20 per 1 Juli, dibawa maju ke 2 Juli
    expect(pvi?.closing.total).toBe(140); // 120 + 20
    expect(pvi?.netChange).toBe(40);
    // Periode pembanding: dari 50 (40 + 10) ke 100.
    expect(pvi?.prevNetChange).toBe(50);
  });

  it("mengonsolidasi beberapa PT dan tetap menghitung PT yang belum terisi", async () => {
    setup({
      confirmations: [
        { kind: "STOCK", companyId: "pvi", date: "2026-07-04", amount: 100 },
        { kind: "KAS", companyId: "ptu", date: "2026-07-05", amount: 25 },
      ],
    });

    const report = await financeReportService.getReport(["pvi", "ptu"], RANGE);

    expect(report.group.closing).toMatchObject({ stock: 100, kas: 25, total: 125 });
    // Hari pertama belum ada konfirmasi mana pun → tidak ada angka sama sekali.
    expect(report.group.series[0]?.total).toBeNull();
    expect(report.group.confirmedDays).toBe(2);
  });

  it("hanya menghitung selisih cross-check pada hari yang punya kedua angka", async () => {
    setup({
      confirmations: [
        { kind: "KAS", companyId: "pvi", date: "2026-07-03", amount: 100 },
        { kind: "KAS", companyId: "pvi", date: "2026-07-04", amount: 120 },
      ],
      systemSums: [
        { kind: "KAS", companyId: "pvi", date: "2026-07-03", amount: 100 },
        { kind: "KAS", companyId: "pvi", date: "2026-07-04", amount: 90 },
        // 5 Juli hanya punya angka sistem — tidak dibandingkan.
        { kind: "KAS", companyId: "pvi", date: "2026-07-05", amount: 95 },
      ],
    });

    const report = await financeReportService.getReport(["pvi", "ptu"], RANGE);
    const kas = report.companies.find((c) => c.id === "pvi")?.crossCheck.kas;

    expect(kas?.comparedDays).toBe(2);
    expect(kas?.mismatchDays).toBe(1);
    expect(kas?.diff).toBe(30);
    expect(kas?.date).toBe("2026-07-04");
    expect(kas?.worstDiff).toBe(30);
  });
});
