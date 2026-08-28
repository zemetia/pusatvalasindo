import prisma from "@/lib/prisma";
import { PageShell, PageHeader, ErrorPanel } from "@/components/admin/page-shell";
import { IconFingerprint } from "@tabler/icons-react";
import { requireResource } from "@/backend/helpers/authz";
import { todayKeyJakarta } from "@/lib/finance-period";
import {
  PresensiPageClient,
  type AttendanceRow,
  type CompanyOption,
} from "@/components/admin/attendance/presensi-page-client";
import type { Prisma } from "@src/generated/prisma/client";

/** `YYYY-MM-DD` yang sah, atau null. */
function normalizeDateKey(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) ? null : value;
}

export default async function PresensiKaryawanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; companyId?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  // View = boleh membuka halaman. Semua koreksi (jam, status, presensi manual)
  // adalah aksi tulis dan diperiksa ulang di API per karyawan — halaman ini
  // hanya menyembunyikan tombolnya bila `canWrite` kosong.
  const authz = await requireResource("attendance.all", "view", locale);

  const dateKey = normalizeDateKey(sp.date) ?? todayKeyJakarta();
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  // `companyIds === null` berarti seluruh PT — jangan disamakan dengan [].
  const scopedCompanyIds = authz.companyIds;
  const requestedCompanyId =
    sp.companyId && sp.companyId !== "all" ? sp.companyId : null;

  // PT yang diminta lewat URL tetap harus lolos scope; tanpa ini siapa pun yang
  // punya halaman ini bisa mengintip PT lain hanya dengan mengetik query-nya.
  const companyId =
    requestedCompanyId && authz.canView(requestedCompanyId) ? requestedCompanyId : null;

  let data;
  try {
    const userWhere: Prisma.userWhereInput = {
      isActive: true,
      ...(companyId
        ? { branch: { companyId } }
        : scopedCompanyIds === null
          ? {}
          : { branch: { companyId: { in: scopedCompanyIds } } }),
    };

    data = await Promise.all([
      prisma.company.findMany({
        where: {
          isActive: true,
          ...(scopedCompanyIds === null ? {} : { id: { in: scopedCompanyIds } }),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      }),
      prisma.user.findMany({
        where: userWhere,
        orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          branch: { select: { name: true, companyId: true } },
          customRole: { select: { name: true } },
        },
      }),
      // Presensi hari itu diambil sekali untuk seluruh karyawan dalam scope,
      // bukan per baris — DB-nya remote, jadi jumlah round-trip yang menentukan
      // waktu muat halaman ini.
      prisma.attendance.findMany({
        where: { date, user: userWhere },
        select: {
          userId: true,
          status: true,
          checkIn: true,
          checkOut: true,
          notes: true,
          isWithDoctorNote: true,
          isLocationSuspect: true,
          editedAt: true,
          editedBy: { select: { name: true } },
          // Cabang tempat clock-in benar-benar terjadi — beda dari cabang
          // profil (branchName) saat karyawan absen di cabang lain (rotasi).
          checkInBranch: { select: { name: true } },
        },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return <ErrorPanel source="kpi/presensi/page" message={msg} />;
  }

  const [companies, users, attendances] = data;

  const byUser = new Map(attendances.map((a) => [a.userId, a]));

  const rows: AttendanceRow[] = users.map((u) => {
    const att = byUser.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      role: u.customRole?.name ?? "Karyawan",
      branchName: u.branch?.name ?? "—",
      checkInBranchName: att?.checkInBranch?.name ?? null,
      companyId: u.branch?.companyId ?? null,
      // `canWrite` dievaluasi per karyawan, bukan sekali untuk halaman:
      // sebuah jabatan bisa boleh melihat PT A+B tapi hanya mengoreksi PT A.
      canEdit: authz.canWrite(u.branch?.companyId ?? null),
      status: att?.status ?? null,
      checkIn: att?.checkIn ? att.checkIn.toISOString() : null,
      checkOut: att?.checkOut ? att.checkOut.toISOString() : null,
      notes: att?.notes ?? null,
      isWithDoctorNote: att?.isWithDoctorNote ?? false,
      isLocationSuspect: att?.isLocationSuspect ?? false,
      editedAt: att?.editedAt ? att.editedAt.toISOString() : null,
      editedByName: att?.editedBy?.name ?? null,
    };
  });

  const companyOptions: CompanyOption[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Presensi Karyawan"
        description="Pantau dan koreksi kehadiran harian seluruh karyawan — jam masuk/pulang, presensi manual, dan status kehadiran."
        icon={<IconFingerprint className="size-5" />}
      />
      <PresensiPageClient
        rows={rows}
        companies={companyOptions}
        dateKey={dateKey}
        companyId={companyId ?? "all"}
        todayKey={todayKeyJakarta()}
        // Filter PT hanya berguna kalau ada lebih dari satu PT dalam jangkauan;
        // pemegang satu PT tidak perlu memilih apa pun.
        showCompanyFilter={companyOptions.length > 1}
      />
    </PageShell>
  );
}
