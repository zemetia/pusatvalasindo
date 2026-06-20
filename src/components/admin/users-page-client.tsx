"use client";

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

type Branch = { id: string; name: string; companyId: string | null };
type Company = { id: string; name: string };
type Role = { id: string; name: string; companyId: string | null };

type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  roleId: string | null;
  roleName: string | null;
  branchId: string | null;
  baseSalary: string | null;
  mealAllowance: string | null;
  transportAllowance: string | null;
  joinDate: string | null;
  isActive: boolean;
  createdAt: string;
  branch: { id: string; name: string } | null;
};

function fmtSalary(val: unknown): string {
  if (val == null) return "—";
  return Number(val.toString()).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

interface UsersPageClientProps {
  users: User[];
  branches: Branch[];
  companies: Company[];
  roles: Role[];
}

export function UsersPageClient({ users, branches, companies, roles }: UsersPageClientProps) {
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

      {users.length === 0 ? (
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
              {users.map((u) => (
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
                  <TableCell className="text-sm text-muted-foreground">
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
