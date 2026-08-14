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

vi.mock("../repositories/held-fund.repository", () => ({
  heldFundRepository: { outstandingReport: vi.fn() },
}));

import prisma from "@/lib/prisma";
import { resolvePeriod } from "@/lib/finance-period";
import { financeReportService } from "./finance-report.service";
import { financeReportRepository } from "../repositories/finance-report.repository";
import { heldFundRepository } from "../repositories/held-fund.repository";

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
  heldFunds?: Awaited<ReturnType<typeof heldFundRepository.outstandingReport>>;
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
  vi.mocked(heldFundRepository.outstandingReport).mockResolvedValue(overrides.heldFunds ?? []);
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

  it("menjumlahkan dana tertahan per arah lintas PT dan tidak mencampurnya ke total aset", async () => {
    setup({
      confirmations: [{ kind: "KAS", companyId: "pvi", date: "2026-07-04", amount: 1000 }],
      heldFunds: [
        {
          companyId: "pvi",
          kind: "CREDIT",
          outstanding: 400,
          outstandingCount: 3,
          settledInRange: 250,
          settledCount: 2,
          addedInRange: 650,
        },
        {
          companyId: "pvi",
          kind: "DEBIT",
          outstanding: 150,
          outstandingCount: 1,
          settledInRange: 0,
          settledCount: 0,
          addedInRange: 150,
        },
        {
          companyId: "ptu",
          kind: "CREDIT",
          outstanding: 100,
          outstandingCount: 1,
          settledInRange: 0,
          settledCount: 0,
          addedInRange: 100,
        },
      ],
    });

    const report = await financeReportService.getReport(["pvi", "ptu"], RANGE);
    const pvi = report.companies.find((c) => c.id === "pvi");

    expect(pvi?.heldFunds.credit).toEqual({
      outstanding: 400,
      outstandingCount: 3,
      settled: 250,
      settledCount: 2,
      added: 650,
    });
    expect(pvi?.heldFunds.debit).toEqual({
      outstanding: 150,
      outstandingCount: 1,
      settled: 0,
      settledCount: 0,
      added: 150,
    });
    // Piutang menambah, hutang mengurangi — bukan dijumlahkan jadi 550.
    expect(pvi?.heldFunds.netAdjustment).toBe(250);

    expect(report.group.heldFunds.credit.outstanding).toBe(500);
    expect(report.group.heldFunds.credit.outstandingCount).toBe(4);
    expect(report.group.heldFunds.debit.outstanding).toBe(150);
    expect(report.group.heldFunds.netAdjustment).toBe(350);

    // Inilah alasan dana tertahan berada di section sendiri: kalau ia ikut
    // dijumlahkan ke posisi aset, seluruh kolom selisih cross-check jadi tidak
    // bisa dicocokkan dengan angka konfirmasi kepala cabang mana pun.
    expect(report.group.closing.total).toBe(1000);
  });

  it("menurunkan Posisi Bersih dari Saldo Fisik + piutang − hutang", async () => {
    setup({
      confirmations: [{ kind: "KAS", companyId: "pvi", date: "2026-07-04", amount: 1000 }],
      heldFunds: [
        {
          companyId: "pvi",
          kind: "CREDIT",
          outstanding: 400,
          outstandingCount: 3,
          settledInRange: 0,
          settledCount: 0,
          addedInRange: 400,
        },
        {
          companyId: "pvi",
          kind: "DEBIT",
          outstanding: 150,
          outstandingCount: 1,
          settledInRange: 0,
          settledCount: 0,
          addedInRange: 150,
        },
      ],
    });

    const report = await financeReportService.getReport(["pvi", "ptu"], RANGE);
    const pvi = report.companies.find((c) => c.id === "pvi");

    expect(pvi?.settlement.physical).toBe(1000);
    expect(pvi?.settlement.receivable).toBe(400);
    expect(pvi?.settlement.payable).toBe(150);
    expect(pvi?.settlement.net).toBe(1250);

    // Konsolidasi memakai basis yang sama: PTU tidak punya konfirmasi maupun
    // dana tertahan, jadi tidak menggeser apa pun.
    expect(report.group.settlement.physical).toBe(1000);
    expect(report.group.settlement.net).toBe(1250);
  });

  it("membiarkan Posisi Bersih null selama Saldo Fisik belum dikonfirmasi", async () => {
    // Tanpa satu pun konfirmasi, yang tersisa hanyalah selisih piutang-hutang.
    // Menampilkannya sebagai "posisi bersih" akan membuat PT yang belum pernah
    // dikonfirmasi terlihat seolah posisinya sudah diketahui dan kebetulan kecil.
    setup({
      heldFunds: [
        {
          companyId: "pvi",
          kind: "CREDIT",
          outstanding: 400,
          outstandingCount: 3,
          settledInRange: 0,
          settledCount: 0,
          addedInRange: 400,
        },
      ],
    });

    const report = await financeReportService.getReport(["pvi", "ptu"], RANGE);
    const pvi = report.companies.find((c) => c.id === "pvi");

    expect(pvi?.settlement.physical).toBeNull();
    expect(pvi?.settlement.net).toBeNull();
    // Piutangnya sendiri tetap dilaporkan — yang belum diketahui hanya fisiknya.
    expect(pvi?.settlement.receivable).toBe(400);
  });

  it("melaporkan dana tertahan nol untuk PT yang belum punya catatan sama sekali", async () => {
    // PT tanpa baris HeldFund sama sekali tidak muncul di hasil query. Nol —
    // bukan em dash — karena "tidak ada dana tertahan" memang berarti nol rupiah
    // tertahan, beda dari saldo yang belum dikonfirmasi.
    setup({ heldFunds: [] });

    const report = await financeReportService.getReport(["pvi", "ptu"], RANGE);

    expect(report.companies.every((c) => c.heldFunds.credit.outstanding === 0)).toBe(true);
    expect(report.companies.every((c) => c.heldFunds.debit.outstanding === 0)).toBe(true);
    expect(report.group.heldFunds.credit.outstanding).toBe(0);
    expect(report.group.heldFunds.debit.outstandingCount).toBe(0);
    expect(report.group.heldFunds.netAdjustment).toBe(0);
  });
});
