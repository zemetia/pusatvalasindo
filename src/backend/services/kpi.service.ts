import type {
  CreateKpiDefinitionInput,
  UpdateKpiDefinitionInput} from "@/backend/repositories/kpi-definition.repository";
import {
  kpiDefinitionRepository
} from "@/backend/repositories/kpi-definition.repository";
import type {
  CreateRoleKpiInput,
  UpdateRoleKpiInput} from "@/backend/repositories/role-kpi.repository";
import {
  roleKpiRepository
} from "@/backend/repositories/role-kpi.repository";
import { resolveInputPolicy as resolvePolicy } from "@/lib/kpi-policy";
import { kpiCollectorService } from "@/backend/services/kpi-collector.service";
import { kpiEntryRepository } from "@/backend/repositories/kpi-entry.repository";
import { kpiPeriodRepository } from "@/backend/repositories/kpi-period.repository";
import { kpiMonthlyResultRepository } from "@/backend/repositories/kpi-monthly-result.repository";
import { NotFoundError, ForbiddenError, ValidationError } from "@/backend/errors/app-error";
import { allows, allowsCompany, resolve } from "@/lib/authz/resolve";
import type { AuthzCaller } from "@/backend/helpers/authz";
import {
  scoreKpiItem,
  computeTotalScore,
  weekOfMonthFor,
  type ScoringEntry,
  type ScoredKpiItem,
} from "@/lib/kpi-scoring";
import prisma from "@/lib/prisma";
import type { KpiInputSource } from "@src/generated/prisma/client";

// Definisinya ada di lib/kpi-policy agar service kolektor bisa memakainya
// tanpa membuat kedua service saling impor. Di-ekspor ulang di sini supaya
// pemanggil lama tidak perlu berubah.
export { resolveInputPolicy } from "@/lib/kpi-policy";

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/**
 * YYYY-MM-DD dari kolom `@db.Date`, dibaca di UTC mengikuti konvensi tanggal
 * proyek (src/lib/finance-period.ts) supaya pengelompokan harian pada KPI
 * bertipe TOLERANCE_LIMIT tidak bergeser saat server berpindah zona waktu.
 */
function dateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type CreateEntryInput = {
  employeeId: string;
  roleKpiId: string;
  occurredAt: Date;
  quantity: number;
  note?: string | null;
  evidenceUrl?: string | null;
};

export const kpiService = {
  // ── Definisi KPI ─────────────────────────────────────────────────────────
  getAllDefinitions: () => kpiDefinitionRepository.findAll(),

  getActiveDefinitions: () => kpiDefinitionRepository.findActive(),

  getDefinitionById: async (id: string) => {
    const d = await kpiDefinitionRepository.findById(id);
    if (!d) throw new NotFoundError("Definisi KPI tidak ditemukan");
    return d;
  },

  createDefinition: (data: CreateKpiDefinitionInput) => kpiDefinitionRepository.create(data),

  updateDefinition: async (id: string, data: UpdateKpiDefinitionInput) => {
    await kpiService.getDefinitionById(id);
    return kpiDefinitionRepository.update(id, data);
  },

  deleteDefinition: async (id: string) => {
    await kpiService.getDefinitionById(id);
    await kpiDefinitionRepository.delete(id);
  },

  // ── KPI per jabatan ──────────────────────────────────────────────────────
  getAllRoleKpis: () => roleKpiRepository.findAll(),

  getByCompanyRole: (companyId: string, customRoleId: string) =>
    roleKpiRepository.findByCompanyRole(companyId, customRoleId),

  getRoleKpiById: async (id: string) => {
    const r = await roleKpiRepository.findById(id);
    if (!r) throw new NotFoundError("Konfigurasi KPI jabatan tidak ditemukan");
    return r;
  },

  createRoleKpi: (data: CreateRoleKpiInput) => roleKpiRepository.create(data),

  updateRoleKpi: async (id: string, data: UpdateRoleKpiInput) => {
    await kpiService.getRoleKpiById(id);
    return roleKpiRepository.update(id, data);
  },

  deleteRoleKpi: async (id: string) => {
    await kpiService.getRoleKpiById(id);
    await roleKpiRepository.delete(id);
  },

  /**
   * KPI yang berlaku untuk seorang karyawan, lengkap dengan kebijakan
   * pengisiannya — dipakai halaman input mandiri maupun form atasan.
   */
  getRoleKpisForEmployee: async (employeeId: string) => {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        customRoleId: true,
        customRole: { select: { id: true, name: true } },
        branch: { select: { companyId: true, company: { select: { name: true } } } },
      },
    });

    // PT karyawan diturunkan dari cabangnya (single source of truth).
    const companyId = employee?.branch?.companyId;
    if (!employee?.customRoleId || !companyId) {
      throw new ValidationError("Karyawan belum memiliki jabatan atau cabang (PT)");
    }

    const roleKpis = await roleKpiRepository.findActiveByCompanyRole(
      companyId,
      employee.customRoleId
    );

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        companyId,
        companyName: employee.branch?.company?.name ?? "",
        customRoleId: employee.customRoleId,
        roleName: employee.customRole?.name ?? "",
      },
      roleKpis: roleKpis.map((rk) => ({ ...rk, policy: resolvePolicy(rk) })),
    };
  },

  // ── Entri KPI ────────────────────────────────────────────────────────────
  getEntriesByEmployeePeriod: (employeeId: string, year: number, month: number) =>
    kpiEntryRepository.findByEmployeePeriod(employeeId, year, month),

  /**
   * Mencatat entri KPI.
   *
   * Dua hal yang ditegakkan di sini dan tidak boleh pindah ke route:
   *  1. KPI ber-sumber SUPERVISOR/SYSTEM tidak bisa dicatat karyawan untuk
   *     dirinya sendiri — inilah pemisah "boleh diisi sendiri" vs "tidak".
   *  2. Periode yang sudah dikunci tidak menerima entri baru, supaya skor yang
   *     sudah dipakai payroll tidak berubah belakangan.
   */
  createEntry: async (caller: AuthzCaller, input: CreateEntryInput) => {
    const roleKpi = await kpiService.getRoleKpiById(input.roleKpiId);
    const policy = resolvePolicy(roleKpi);

    if (!roleKpi.isActive) {
      throw new ValidationError("KPI ini sudah tidak aktif untuk jabatan tersebut");
    }

    if (policy.inputSource === "SYSTEM") {
      throw new ValidationError(
        "KPI ini diisi otomatis oleh sistem dan tidak dapat dicatat manual"
      );
    }

    const isSelf = caller.id === input.employeeId;
    // Mencatat KPI orang lain = hak TULIS penilaian, dan di-scope ke PT si KPI —
    // bukan lagi "punya KPI_APPROVE di PT mana pun".
    const canRecordOthers = canReviewCompany(caller, roleKpi.companyId);

    if (isSelf) {
      if (policy.inputSource !== "SELF" && !canRecordOthers) {
        throw new ForbiddenError("KPI ini hanya boleh dicatat oleh atasan, bukan diisi sendiri");
      }
      if (!allows(caller.subject, "kpi.self", "write") && !canRecordOthers) {
        throw new ForbiddenError("Tidak memiliki izin mengisi KPI");
      }
    } else if (!canRecordOthers) {
      throw new ForbiddenError("Tidak memiliki izin mencatat KPI karyawan lain");
    }

    // Entri harus cocok dengan jabatan & PT karyawannya, bukan sekadar ada.
    const employee = await prisma.user.findUnique({
      where: { id: input.employeeId },
      select: { customRoleId: true, branch: { select: { companyId: true } } },
    });
    if (
      !employee ||
      employee.customRoleId !== roleKpi.customRoleId ||
      employee.branch?.companyId !== roleKpi.companyId
    ) {
      throw new ValidationError("KPI ini tidak terdaftar untuk jabatan karyawan tersebut");
    }

    if (policy.requiresEvidence && !input.evidenceUrl) {
      throw new ValidationError("KPI ini wajib disertai bukti");
    }

    // Dibaca di UTC, sejalan dengan cara `occurredAt` disimpan (@db.Date).
    const year = input.occurredAt.getUTCFullYear();
    const month = input.occurredAt.getUTCMonth() + 1;

    const period = await kpiPeriodRepository.find(input.employeeId, month, year);
    if (period?.status === "LOCKED") {
      throw new ValidationError("Periode ini sudah dikunci dan tidak menerima catatan baru");
    }

    // Entri untuk orang lain (dari atasan/HR) langsung sah; entri atas diri
    // sendiri menunggu persetujuan bila KPI-nya diatur begitu — termasuk bila
    // yang mencatat kebetulan punya izin menyetujui. Tanpa syarat terakhir itu
    // seorang Kepala Cabang bisa meloloskan penilaian atas dirinya sendiri,
    // padahal reviewEntry sudah melarang menyetujui entri milik sendiri.
    const source: KpiInputSource = isSelf ? "SELF" : "SUPERVISOR";
    const needsApproval = isSelf && policy.requiresApproval;

    return kpiEntryRepository.create({
      employeeId: input.employeeId,
      roleKpiId: input.roleKpiId,
      occurredAt: input.occurredAt,
      periodYear: year,
      periodMonth: month,
      weekOfMonth: weekOfMonthFor(input.occurredAt),
      quantity: input.quantity,
      note: input.note ?? null,
      evidenceUrl: input.evidenceUrl ?? null,
      source,
      status: needsApproval ? "PENDING" : "APPROVED",
      createdById: caller.id,
    });
  },

  /**
   * Menyetujui atau menolak entri. Yang ditolak tetap tersimpan sebagai jejak
   * audit — hanya entri APPROVED yang ikut dihitung.
   */
  reviewEntry: async (
    caller: AuthzCaller,
    entryId: string,
    decision: "APPROVED" | "REJECTED",
    reviewNote?: string
  ) => {
    const entry = await kpiEntryRepository.findById(entryId);
    if (!entry) throw new NotFoundError("Entri KPI tidak ditemukan");

    if (entry.employeeId === caller.id) {
      throw new ForbiddenError("Tidak dapat menyetujui entri KPI milik sendiri");
    }

    // Satu gerbang, dua hal sekaligus: punya hak menilai DAN PT entri itu ada
    // dalam scope tulisnya. Dulu keduanya terpisah (KPI_APPROVE lalu
    // assertKpiCompanyAccess), dan yang kedua membandingkan langsung dengan PT
    // si pemanggil sehingga wewenang lintas PT mustahil dinyatakan.
    if (!canReviewCompany(caller, entry.roleKpi.companyId)) {
      throw new ForbiddenError("Tidak memiliki izin menyetujui entri KPI PT ini");
    }

    const period = await kpiPeriodRepository.find(
      entry.employeeId,
      entry.periodMonth,
      entry.periodYear
    );
    if (period?.status === "LOCKED") {
      throw new ValidationError("Periode ini sudah dikunci");
    }

    return kpiEntryRepository.review(entryId, {
      status: decision,
      reviewedById: caller.id,
      reviewNote: reviewNote ?? null,
    });
  },

  getPendingEntries: async (caller: AuthzCaller, limit = 200) => {
    const decision = resolve(caller.subject, "kpi.review", "view");
    if (!decision.allowed) {
      throw new ForbiddenError("Tidak memiliki izin melihat antrian persetujuan KPI");
    }
    // `companyIds === null` berarti seluruh PT — jangan disamakan dengan array
    // kosong, yang justru harus menghasilkan antrian kosong.
    const scope =
      decision.companyIds === null
        ? {}
        : { roleKpi: { companyId: { in: decision.companyIds } } };
    return kpiEntryRepository.findPending(scope, limit);
  },

  /**
   * Menghapus entri. Karyawan hanya boleh menghapus entri miliknya sendiri yang
   * belum disetujui — begitu disetujui, penghapusan jadi wewenang atasan.
   */
  deleteEntry: async (caller: AuthzCaller, entryId: string) => {
    const entry = await kpiEntryRepository.findById(entryId);
    if (!entry) throw new NotFoundError("Entri KPI tidak ditemukan");

    const period = await kpiPeriodRepository.find(
      entry.employeeId,
      entry.periodMonth,
      entry.periodYear
    );
    if (period?.status === "LOCKED") {
      throw new ValidationError("Periode ini sudah dikunci");
    }

    // Hak atasan sudah mencakup PT-nya, jadi tidak ada lagi cek PT terpisah
    // setelahnya: yang bukan atasan untuk PT ini jatuh ke aturan "entri sendiri".
    const isReviewer = canReviewCompany(caller, entry.roleKpi.companyId);

    if (!isReviewer) {
      if (entry.employeeId !== caller.id) {
        throw new ForbiddenError("Tidak dapat menghapus entri milik karyawan lain");
      }
      if (entry.status === "APPROVED") {
        throw new ForbiddenError(
          "Entri yang sudah disetujui hanya dapat dihapus oleh atasan"
        );
      }
    }

    await kpiEntryRepository.delete(entryId);
  },

  // ── Periode ──────────────────────────────────────────────────────────────
  getPeriod: (employeeId: string, month: number, year: number) =>
    kpiPeriodRepository.find(employeeId, month, year),

  lockPeriod: async (caller: AuthzCaller, employeeId: string, month: number, year: number) => {
    await assertCanReviewEmployee(caller, employeeId, "mengunci periode KPI");
    // Kunci setelah skor final dihitung, supaya angka yang dibekukan konsisten
    // dengan entri yang ada saat itu.
    await kpiService.calculateMonthlyResult(employeeId, month, year);
    return kpiPeriodRepository.lock(employeeId, month, year, caller.id);
  },

  unlockPeriod: async (caller: AuthzCaller, employeeId: string, month: number, year: number) => {
    await assertCanReviewEmployee(caller, employeeId, "membuka periode KPI");
    return kpiPeriodRepository.unlock(employeeId, month, year);
  },

  /**
   * Gerbang untuk route yang menyentuh KPI seorang karyawan tanpa membaca
   * entrinya lebih dulu (hitung ulang skor, kunci/buka periode). Diekspor supaya
   * route tidak menyusun ulang aturan yang sama dengan versinya sendiri.
   */
  assertCanReview: (caller: AuthzCaller, employeeId: string) =>
    assertCanReviewEmployee(caller, employeeId, "mengubah KPI karyawan ini"),

  /**
   * Boleh melihat KPI karyawan lain? Entri sendiri selalu boleh. Sengaja di
   * service, bukan di route: PT karyawannya harus dibaca dulu, dan aturan yang
   * sama dipakai oleh /api/kpi-entries maupun /api/kpi-monthly-results.
   */
  assertCanViewEntriesOf: async (caller: AuthzCaller, employeeId: string) => {
    if (caller.id === employeeId) return;
    const companyId = await companyIdOfEmployee(employeeId);
    if (!allowsCompany(caller.subject, "kpi.review", "view", companyId)) {
      throw new ForbiddenError("Tidak memiliki izin melihat KPI karyawan lain");
    }
  },

  /** PT yang boleh dinilai — untuk penarikan massal. `null` = seluruh PT. */
  reviewableCompanyIds: (caller: AuthzCaller): string[] | null => {
    const decision = resolve(caller.subject, "kpi.review", "write");
    if (!decision.allowed) throw new ForbiddenError("Tidak memiliki izin menilai KPI");
    return decision.companyIds;
  },

  // ── Hasil bulanan ────────────────────────────────────────────────────────
  getMonthlyResult: (employeeId: string, month: number, year: number) =>
    kpiMonthlyResultRepository.findByEmployeePeriod(employeeId, month, year),

  getMonthlyResultsByEmployee: (employeeId: string) =>
    kpiMonthlyResultRepository.findByEmployee(employeeId),

  /**
   * Hitung ulang skor sebulan dari entri yang disetujui, lalu simpan.
   *
   * Bobot dikalikan tepat sekali (di computeTotalScore) — engine lama
   * mengalikannya dua kali sehingga skor selalu jatuh jauh di bawah semestinya.
   */
  calculateMonthlyResult: async (employeeId: string, month: number, year: number) => {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { customRoleId: true, branch: { select: { companyId: true } } },
    });

    const companyId = employee?.branch?.companyId;
    if (!employee?.customRoleId || !companyId) {
      throw new ValidationError("Karyawan belum memiliki jabatan atau cabang (PT)");
    }

    // Tarik dulu KPI yang bersumber dari modul lain (absensi), baru baca entri.
    // Urutannya penting: kalau dibalik, skor akan memakai data absensi periode
    // sebelumnya. Penarikan bersifat idempoten dan melewati periode terkunci,
    // jadi aman dipanggil setiap kali skor dihitung.
    const collection = await kpiCollectorService.collectForEmployee(employeeId, month, year);

    const [roleKpis, entries] = await Promise.all([
      roleKpiRepository.findActiveByCompanyRole(companyId, employee.customRoleId),
      kpiEntryRepository.findApprovedForScoring(employeeId, year, month),
    ]);

    const entriesByRoleKpi = new Map<string, ScoringEntry[]>();
    for (const entry of entries) {
      const list = entriesByRoleKpi.get(entry.roleKpiId) ?? [];
      list.push({
        occurredAt: dateKey(entry.occurredAt),
        weekOfMonth: entry.weekOfMonth,
        quantity: Number(entry.quantity),
      });
      entriesByRoleKpi.set(entry.roleKpiId, list);
    }

    const items: ScoredKpiItem[] = roleKpis.map((rk) => {
      const score = scoreKpiItem(
        {
          scoringType: rk.definition.scoringType,
          direction: rk.definition.direction,
          weight: toNumber(rk.weight),
          targetValue: toNullableNumber(rk.targetValue),
          basePoint: toNullableNumber(rk.basePoint),
          pointPerUnit: toNullableNumber(rk.pointPerUnit),
          toleranceLimit: toNullableNumber(rk.toleranceLimit),
          toleranceScope: rk.toleranceScope,
        },
        entriesByRoleKpi.get(rk.id) ?? []
      );

      return {
        ...score,
        roleKpiId: rk.id,
        kpiId: rk.definition.id,
        kpiCode: rk.definition.code,
        kpiName: rk.definition.name,
        scoringType: rk.definition.scoringType,
        unit: rk.definition.unit,
        weight: toNumber(rk.weight),
        inputSource: resolvePolicy(rk).inputSource,
      };
    });

    const summary = computeTotalScore(items);

    return kpiMonthlyResultRepository.upsert({
      employeeId,
      month,
      year,
      totalScore: summary.totalScore,
      grade: summary.grade,
      breakdownJson: {
        weightSum: summary.weightSum,
        items: summary.items,
        // Hasil penarikan otomatis ikut disimpan supaya halaman penilaian bisa
        // menampilkan hari mana yang dilewati kolektor dan perlu diperiksa
        // atasan — tanpa ini, hari bermasalah hilang tanpa jejak.
        autoCollected: collection.collected,
        autoUnsupported: collection.unsupported,
      },
    });
  },
};

// Dulu di sini ada `isGlobalKpiCaller` — "pemanggil tanpa companyId berarti
// peninjau lintas PT". Sudah dibuang: yang tidak punya PT bukan hanya Super
// Admin/Owner, tapi juga pengguna biasa yang belum ditempatkan di cabang, dan
// mereka justru mendapat akses SELURUH PT dari aturan itu. `allowsCompany`
// menolak `companyId: null` kecuali scope-nya memang seluruh PT (ALL), jadi
// arah gagalnya sekarang aman — sejalan dengan mode OWN di resolve.ts.

/** Boleh menilai/mengubah KPI milik PT ini? Gerbang tunggal modul penilaian. */
function canReviewCompany(caller: AuthzCaller, companyId: string | null) {
  return allowsCompany(caller.subject, "kpi.review", "write", companyId);
}

/** PT karyawan diturunkan dari cabangnya — sumber tunggal, sama seperti modul lain. */
async function companyIdOfEmployee(employeeId: string): Promise<string | null> {
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { branch: { select: { companyId: true } } },
  });
  if (!employee) throw new NotFoundError("Karyawan tidak ditemukan");
  return employee.branch?.companyId ?? null;
}

async function assertCanReviewEmployee(
  caller: AuthzCaller,
  employeeId: string,
  action: string
) {
  const companyId = await companyIdOfEmployee(employeeId);
  if (!canReviewCompany(caller, companyId)) {
    throw new ForbiddenError(`Tidak memiliki izin ${action}`);
  }
}
