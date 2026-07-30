import prisma from "@/lib/prisma";
import { roleKpiRepository } from "@/backend/repositories/role-kpi.repository";
import { kpiPeriodRepository } from "@/backend/repositories/kpi-period.repository";
import { resolveInputPolicy } from "@/lib/kpi-policy";
import {
  runCollector,
  isKnownCollector,
  COLLECTOR_LABELS,
  type AttendanceRecord,
  type SkippedDay,
} from "@/lib/kpi-collectors";
import { weekOfMonthFor } from "@/lib/kpi-scoring";

/**
 * Menarik data KPI dari modul lain (saat ini: absensi) menjadi entri KPI.
 *
 * Sifatnya **idempoten**: setiap kali dijalankan, entri hasil sistem untuk
 * periode itu dihapus lalu ditulis ulang. Tanpa itu, menjalankan penarikan dua
 * kali akan menggandakan pelanggaran — dan penarikan memang dipanggil berkali-
 * kali (tiap kali skor dihitung ulang, tiap kali slip gaji dibuat).
 *
 * Hanya entri bersumber SYSTEM yang disentuh; catatan manual dari atasan dan
 * karyawan tidak pernah ikut terhapus.
 */

export type CollectedKpi = {
  roleKpiId: string;
  kpiName: string;
  collectorLabel: string;
  entryCount: number;
  /** Total kejadian (menghitung bobot, mis. alpa = 3). */
  totalQuantity: number;
  skipped: { date: string; reason: string }[];
};

export type CollectResult = {
  employeeId: string;
  month: number;
  year: number;
  /** Periode terkunci — tidak ada yang diubah. */
  locked: boolean;
  collected: CollectedKpi[];
  /** KPI bersumber SYSTEM yang kolektornya belum tersedia. */
  unsupported: { kpiName: string; systemSourceKey: string | null }[];
};

/** Kolom `@db.Date` dibaca di UTC — lihat konvensi di src/lib/finance-period.ts. */
function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function serializeSkipped(skipped: SkippedDay[]) {
  return skipped.map((s) => ({ date: toIsoDate(s.date), reason: s.reason }));
}

export const kpiCollectorService = {
  /**
   * Tarik ulang seluruh KPI otomatis milik satu karyawan untuk satu periode.
   * Aman dipanggil kapan saja; periode yang sudah dikunci dilewati.
   */
  collectForEmployee: async (
    employeeId: string,
    month: number,
    year: number
  ): Promise<CollectResult> => {
    const base: CollectResult = {
      employeeId,
      month,
      year,
      locked: false,
      collected: [],
      unsupported: [],
    };

    const [employee, period] = await Promise.all([
      prisma.user.findUnique({
        where: { id: employeeId },
        select: { customRoleId: true, branch: { select: { companyId: true } } },
      }),
      kpiPeriodRepository.find(employeeId, month, year),
    ]);

    if (period?.status === "LOCKED") return { ...base, locked: true };

    const companyId = employee?.branch?.companyId;
    if (!employee?.customRoleId || !companyId) return base;

    const roleKpis = await roleKpiRepository.findActiveByCompanyRole(
      companyId,
      employee.customRoleId
    );

    const systemKpis = roleKpis.filter(
      (rk) => resolveInputPolicy(rk).inputSource === "SYSTEM"
    );
    if (systemKpis.length === 0) return base;

    // Satu query absensi dipakai semua kolektor — periode yang sama, karyawan
    // yang sama. Menariknya per-KPI akan mengulang query yang identik.
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const attendances = await prisma.attendance.findMany({
      where: { userId: employeeId, date: { gte: startDate, lt: endDate } },
      select: {
        date: true,
        status: true,
        checkIn: true,
        checkOut: true,
        isWithDoctorNote: true,
      },
      orderBy: { date: "asc" },
    });

    const records: AttendanceRecord[] = attendances.map((a) => ({
      date: a.date,
      status: a.status,
      checkIn: a.checkIn,
      checkOut: a.checkOut,
      isWithDoctorNote: a.isWithDoctorNote,
    }));

    const collected: CollectedKpi[] = [];
    const unsupported: CollectResult["unsupported"] = [];

    for (const roleKpi of systemKpis) {
      const key = roleKpi.definition.systemSourceKey;
      if (!isKnownCollector(key)) {
        unsupported.push({ kpiName: roleKpi.definition.name, systemSourceKey: key ?? null });
        continue;
      }

      const output = runCollector(key, records, roleKpi.systemConfig);

      // Ganti-total dalam satu transaksi: kalau penulisan gagal di tengah,
      // jangan sampai entri lama sudah terhapus sementara yang baru belum ada.
      await prisma.$transaction([
        prisma.kpiEntry.deleteMany({
          where: {
            employeeId,
            roleKpiId: roleKpi.id,
            periodYear: year,
            periodMonth: month,
            source: "SYSTEM",
          },
        }),
        prisma.kpiEntry.createMany({
          data: output.entries.map((entry) => ({
            employeeId,
            roleKpiId: roleKpi.id,
            occurredAt: entry.occurredAt,
            periodYear: year,
            periodMonth: month,
            weekOfMonth: weekOfMonthFor(entry.occurredAt),
            quantity: entry.quantity,
            note: entry.note,
            source: "SYSTEM" as const,
            // Data sistem tidak menunggu persetujuan — tidak ada yang diklaim
            // oleh karyawan, angkanya diambil apa adanya dari absensi.
            status: "APPROVED" as const,
            createdById: null,
          })),
        }),
      ]);

      collected.push({
        roleKpiId: roleKpi.id,
        kpiName: roleKpi.definition.name,
        collectorLabel: COLLECTOR_LABELS[key] ?? key,
        entryCount: output.entries.length,
        totalQuantity: output.entries.reduce((sum, e) => sum + e.quantity, 0),
        skipped: serializeSkipped(output.skipped),
      });
    }

    return { ...base, collected, unsupported };
  },

  /**
   * Tarik data untuk seluruh karyawan aktif dalam satu periode — dipakai
   * pemicu terjadwal (tutup bulan) dan tombol tarik massal.
   *
   * Dijalankan berurutan, bukan Promise.all: database-nya remote, dan puluhan
   * transaksi paralel lebih mudah menghabiskan pool koneksi daripada
   * mempercepat apa pun.
   */
  /**
   * `companyIds: null` berarti seluruh PT; array berarti hanya PT itu, dan array
   * KOSONG berarti tidak ada satu pun — bukan "semua". Bentuknya mengikuti
   * `AuthzDecision.companyIds` supaya scope izin bisa diteruskan apa adanya
   * tanpa penerjemahan yang bisa salah arah.
   */
  collectForPeriod: async (
    month: number,
    year: number,
    options: { companyIds?: string[] | null } = {}
  ): Promise<CollectResult[]> => {
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        customRoleId: { not: null },
        ...(options.companyIds == null
          ? {}
          : { branch: { companyId: { in: options.companyIds } } }),
      },
      select: { id: true },
    });

    const results: CollectResult[] = [];
    for (const employee of employees) {
      results.push(await kpiCollectorService.collectForEmployee(employee.id, month, year));
    }
    return results;
  },
};
