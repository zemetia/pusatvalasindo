import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserActions } from "@/components/admin/user-actions";
import { CreateUserSheet } from "@/components/admin/create-user-sheet";

// Dynamic roles are now fetched from the database


function fmtSalary(val: unknown): string {
  if (val == null) return "—";
  return Number(val.toString()).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export default async function UsersPage() {
  const [users, branches, companies, roles] = await Promise.all([
    prisma.user.findMany({
      include: {
        branch: { select: { id: true, name: true } },
        customRole: { select: { id: true, name: true } },
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.custom_role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
  ]);

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
    joinDate: u.joinDate?.toISOString() ?? null,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    branch: u.branch,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pengguna</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daftar seluruh pengguna sistem per cabang
          </p>
        </div>
        <CreateUserSheet branches={branches} companies={companies} roles={roles} />
      </div>

      {serialized.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada pengguna</p>
          <p className="text-sm mt-1">Buat pengguna pertama untuk memulai.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead className="text-right">Gaji Pokok</TableHead>
                <TableHead>Bergabung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {serialized.map((u) => (
                <TableRow key={u.id} className={!u.isActive ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {u.email}
                    {!u.emailVerified && (
                      <Badge variant="outline" className="ml-1.5 text-xs">belum verif</Badge>
                    )}
                  </TableCell>
                  <TableCell>{u.branch?.name ?? "—"}</TableCell>
                  <TableCell>
                    {u.roleName ? (
                      <Badge variant="secondary">{u.roleName}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.phone ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{fmtSalary(u.baseSalary)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {u.joinDate
                      ? new Date(u.joinDate).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? "default" : "outline"}>
                      {u.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <UserActions user={u} branches={branches} companies={companies} roles={roles} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
