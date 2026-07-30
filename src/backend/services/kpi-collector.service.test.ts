import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
    kpiEntry: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/backend/repositories/role-kpi.repository", () => ({
  roleKpiRepository: { findActiveByCompanyRole: vi.fn() },
}));

vi.mock("@/backend/repositories/kpi-period.repository", () => ({
  kpiPeriodRepository: { find: vi.fn() },
}));

import prisma from "@/lib/prisma";
import { roleKpiRepository } from "@/backend/repositories/role-kpi.repository";
import { kpiPeriodRepository } from "@/backend/repositories/kpi-period.repository";
import { kpiCollectorService } from "./kpi-collector.service";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = prisma as any;
const roleKpiRepo = roleKpiRepository as any;
const periodRepo = kpiPeriodRepository as any;

const EMPLOYEE = { customRoleId: "role-1", branch: { companyId: "pt-1" } };

/** RoleKpi minimal yang dibutuhkan kolektor. */
const roleKpi = (over: Record<string, unknown> = {}) => ({
  id: "rk-closing",
  inputSource: null,
  requiresApproval: null,
  requiresEvidence: null,
  systemConfig: { deadline: "05:15", graceMinutes: 60 },
  definition: {
    name: "Closing Tepat Waktu",
    defaultInputSource: "SYSTEM",
    defaultRequiresApproval: false,
    defaultRequiresEvidence: false,
    systemSourceKey: "ATTENDANCE_CLOSING",
  },
  ...over,
});

/**
 * Shift 3 Juli, absen pulang jam 07.00 esok pagi = lewat batas 06.15.
 * `date` memakai tengah malam UTC, persis seperti nilai yang dikembalikan
 * kolom `@db.Date` dari database.
 */
const lateClosing = {
  date: new Date(Date.UTC(2026, 6, 3)),
  status: "PRESENT" as const,
  checkIn: new Date(2026, 6, 3, 17, 30),
  checkOut: new Date(2026, 6, 4, 7, 0),
  isWithDoctorNote: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue(EMPLOYEE);
  periodRepo.find.mockResolvedValue(null);
  db.attendance.findMany.mockResolvedValue([lateClosing]);
  db.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  db.kpiEntry.deleteMany.mockResolvedValue({ count: 0 });
  db.kpiEntry.createMany.mockResolvedValue({ count: 0 });
});

describe("kpiCollectorService.collectForEmployee", () => {
  it("menulis entri hasil kolektor untuk KPI bersumber sistem", async () => {
    roleKpiRepo.findActiveByCompanyRole.mockResolvedValue([roleKpi()]);

    const result = await kpiCollectorService.collectForEmployee("emp-1", 7, 2026);

    expect(result.collected).toHaveLength(1);
    expect(result.collected[0].entryCount).toBe(1);

    const created = db.kpiEntry.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      employeeId: "emp-1",
      roleKpiId: "rk-closing",
      periodMonth: 7,
      periodYear: 2026,
      source: "SYSTEM",
      status: "APPROVED",
      createdById: null,
    });
  });

  it("menghapus entri sistem lama dulu supaya penarikan berulang tidak menggandakan", async () => {
    roleKpiRepo.findActiveByCompanyRole.mockResolvedValue([roleKpi()]);

    await kpiCollectorService.collectForEmployee("emp-1", 7, 2026);

    expect(db.kpiEntry.deleteMany).toHaveBeenCalledWith({
      where: {
        employeeId: "emp-1",
        roleKpiId: "rk-closing",
        periodYear: 2026,
        periodMonth: 7,
        source: "SYSTEM",
      },
    });
    // Hapus & tulis harus berada dalam satu transaksi.
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("tidak menyentuh entri manual — hanya yang bersumber SYSTEM yang dihapus", async () => {
    roleKpiRepo.findActiveByCompanyRole.mockResolvedValue([roleKpi()]);

    await kpiCollectorService.collectForEmployee("emp-1", 7, 2026);

    const where = db.kpiEntry.deleteMany.mock.calls[0][0].where;
    expect(where.source).toBe("SYSTEM");
  });

  it("melewati periode yang sudah dikunci tanpa menulis apa pun", async () => {
    periodRepo.find.mockResolvedValue({ status: "LOCKED" });
    roleKpiRepo.findActiveByCompanyRole.mockResolvedValue([roleKpi()]);

    const result = await kpiCollectorService.collectForEmployee("emp-1", 7, 2026);

    expect(result.locked).toBe(true);
    expect(db.kpiEntry.deleteMany).not.toHaveBeenCalled();
    expect(db.kpiEntry.createMany).not.toHaveBeenCalled();
  });

  it("mengabaikan KPI yang diisi manual", async () => {
    roleKpiRepo.findActiveByCompanyRole.mockResolvedValue([
      roleKpi({
        id: "rk-manual",
        definition: { ...roleKpi().definition, defaultInputSource: "SUPERVISOR" },
      }),
    ]);

    const result = await kpiCollectorService.collectForEmployee("emp-1", 7, 2026);

    expect(result.collected).toHaveLength(0);
    expect(db.kpiEntry.createMany).not.toHaveBeenCalled();
  });

  it("menghormati override inputSource di tingkat jabatan", async () => {
    // Definisi bilang SUPERVISOR, tapi jabatan ini menimpanya jadi SYSTEM.
    roleKpiRepo.findActiveByCompanyRole.mockResolvedValue([
      roleKpi({
        inputSource: "SYSTEM",
        definition: { ...roleKpi().definition, defaultInputSource: "SUPERVISOR" },
      }),
    ]);

    const result = await kpiCollectorService.collectForEmployee("emp-1", 7, 2026);
    expect(result.collected).toHaveLength(1);
  });

  it("melaporkan KPI sistem yang kolektornya belum ada, bukan mendiamkannya", async () => {
    roleKpiRepo.findActiveByCompanyRole.mockResolvedValue([
      roleKpi({
        definition: {
          ...roleKpi().definition,
          name: "Jumlah Omzet",
          systemSourceKey: "OMZET_BRANCH",
        },
      }),
    ]);

    const result = await kpiCollectorService.collectForEmployee("emp-1", 7, 2026);

    expect(result.collected).toHaveLength(0);
    expect(result.unsupported).toEqual([
      { kpiName: "Jumlah Omzet", systemSourceKey: "OMZET_BRANCH" },
    ]);
  });

  it("meneruskan hari yang dilewati agar bisa diperiksa manual", async () => {
    db.attendance.findMany.mockResolvedValue([
      { ...lateClosing, checkOut: null },
    ]);
    roleKpiRepo.findActiveByCompanyRole.mockResolvedValue([roleKpi()]);

    const result = await kpiCollectorService.collectForEmployee("emp-1", 7, 2026);

    expect(result.collected[0].entryCount).toBe(0);
    expect(result.collected[0].skipped).toEqual([
      { date: "2026-07-03", reason: expect.stringContaining("absen pulang") },
    ]);
  });

  it("karyawan tanpa jabatan atau cabang tidak menghasilkan penarikan", async () => {
    db.user.findUnique.mockResolvedValue({ customRoleId: null, branch: null });

    const result = await kpiCollectorService.collectForEmployee("emp-1", 7, 2026);

    expect(result.collected).toHaveLength(0);
    expect(roleKpiRepo.findActiveByCompanyRole).not.toHaveBeenCalled();
  });

  it("hanya menarik absensi bulan yang diminta", async () => {
    roleKpiRepo.findActiveByCompanyRole.mockResolvedValue([roleKpi()]);

    await kpiCollectorService.collectForEmployee("emp-1", 7, 2026);

    const where = db.attendance.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("emp-1");
    expect(where.date.gte).toEqual(new Date(2026, 6, 1));
    expect(where.date.lt).toEqual(new Date(2026, 7, 1));
  });
});

describe("kpiCollectorService.collectForPeriod", () => {
  it("menarik tiap karyawan aktif satu per satu", async () => {
    db.user.findMany.mockResolvedValue([{ id: "emp-1" }, { id: "emp-2" }]);
    roleKpiRepo.findActiveByCompanyRole.mockResolvedValue([roleKpi()]);

    const results = await kpiCollectorService.collectForPeriod(7, 2026);

    expect(results).toHaveLength(2);
    expect(db.kpiEntry.createMany).toHaveBeenCalledTimes(2);
  });

  it("membatasi ke PT dalam scope bila diminta", async () => {
    db.user.findMany.mockResolvedValue([]);

    await kpiCollectorService.collectForPeriod(7, 2026, { companyIds: ["pt-1", "pt-2"] });

    const where = db.user.findMany.mock.calls[0][0].where;
    expect(where.branch).toEqual({ companyId: { in: ["pt-1", "pt-2"] } });
    expect(where.isActive).toBe(true);
  });

  // Scope kosong berarti "tidak ada PT satu pun", bukan "semua PT" — kalau ini
  // terbalik, jabatan tanpa wewenang justru menarik seluruh karyawan.
  it("scope kosong tidak menarik siapa pun", async () => {
    db.user.findMany.mockResolvedValue([]);

    await kpiCollectorService.collectForPeriod(7, 2026, { companyIds: [] });

    const where = db.user.findMany.mock.calls[0][0].where;
    expect(where.branch).toEqual({ companyId: { in: [] } });
  });
});
