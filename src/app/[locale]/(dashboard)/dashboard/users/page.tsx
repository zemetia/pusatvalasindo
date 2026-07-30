import prisma from "@/lib/prisma";
import { ErrorPanel } from "@/components/admin/page-shell";
import { UsersPageClient } from "@/components/admin/users-page-client";
import { requireResource } from "@/backend/helpers/authz";
import { resolve } from "@/lib/authz/resolve";

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Gerbangnya resource `users`, bukan lagi `isAdminRole`: siapa yang boleh
  // membuka halaman ini — dan untuk PT mana — sepenuhnya datang dari matriks
  // izin, sehingga bisa didelegasikan tanpa menyentuh kode.
  const authz = await requireResource("users", "view", locale);

  // Daftar PT yang boleh DIUBAH bisa lebih sempit daripada yang boleh dilihat
  // ("lihat PT A+B, ubah hanya PT A"), jadi sumbu tulis diresolusi tersendiri.
  // `null` berarti seluruh PT.
  const writeDecision = resolve(authz.subject, "users", "write");
  const writableCompanyIds = writeDecision.allowed ? writeDecision.companyIds : [];

  // Pengguna dimiliki satu PT lewat cabangnya. Saat scope-nya seluruh PT,
  // filternya sengaja dikosongkan — `{ branch: { ... } }` yang selalu dipasang
  // akan ikut membuang pengguna yang belum punya cabang.
  const companyIds = authz.companyIds;
  const userWhere =
    companyIds === null ? {} : { branch: { companyId: { in: companyIds } } };

  let result;
  try {
    result = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        include: {
          branch: {
            select: { id: true, name: true, companyId: true, company: { select: { code: true } } },
          },
          customRole: { select: { id: true, name: true } },
        },
        orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.branch.findMany({
        where: { isActive: true, ...authz.where() },
        orderBy: { name: "asc" },
        select: { id: true, name: true, companyId: true },
      }),
      prisma.company.findMany({
        where: { isActive: true, ...authz.where("id") },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.custom_role.findMany({
        // Jabatan yang boleh ditetapkan mengikuti scope yang sama: pemegang
        // scope satu PT tidak bisa memberi jabatan milik PT lain — termasuk
        // jabatan sistem (companyId null) seperti Super Admin/Owner.
        where: companyIds === null ? undefined : { companyId: { in: companyIds } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, companyId: true },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <ErrorPanel source="users/page" message={msg} />
    )
  }
  const [users, branches, companies, roles] = result;

  const serialized = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    phone: u.phone,
    roleId: u.customRoleId,
    roleName: u.customRole?.name || null,
    branchId: u.branchId,
    baseSalary: u.baseSalary?.toString() ?? null,
    mealAllowance: u.mealAllowance?.toString() ?? null,
    transportAllowance: u.transportAllowance?.toString() ?? null,
    positionAllowance: u.positionAllowance?.toString() ?? null,
    bpjsKesehatan: u.bpjsKesehatan?.toString() ?? null,
    joinDate: u.joinDate?.toISOString() ?? null,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    branch: u.branch,
  }));

  // Nama karyawan baru jadi tautan bila caller memang boleh membuka detailnya —
  // gerbangnya sama persis dengan yang dijaga halaman detail.
  const canOpenDetail = authz.can("users.detail", "view");

  return (
    <UsersPageClient
      users={serialized}
      branches={branches}
      companies={companies}
      roles={roles}
      canOpenDetail={canOpenDetail}
      writableCompanyIds={writableCompanyIds}
    />
  );
}
