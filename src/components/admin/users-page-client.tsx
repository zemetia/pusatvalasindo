"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
import {
  PageShell,
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { IconUsers } from "@tabler/icons-react";

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
  joinDate: string | null;
  isActive: boolean;
  createdAt: string;
  branch: {
    id: string;
    name: string;
    companyId: string | null;
    company: { code: string } | null;
  } | null;
};

interface UsersPageClientProps {
  users: User[];
  branches: Branch[];
  companies: Company[];
  roles: Role[];
  /** Izin `users.view_detail` — menentukan nama jadi tautan ke rapor karyawan. */
  canOpenDetail?: boolean;
  /**
   * PT yang boleh diubah (sumbu tulis resource `users`). `null` = seluruh PT.
   * Sengaja daftar PT, bukan satu boolean: sebuah jabatan bisa berhak melihat
   * pengguna PT A+B tapi hanya boleh mengubah PT A.
   */
  writableCompanyIds?: string[] | null;
}

export function UsersPageClient({
  users,
  branches,
  companies,
  roles,
  canOpenDetail = false,
  writableCompanyIds = [],
}: UsersPageClientProps) {
  const [search, setSearch] = useState("");

  // Pengguna tanpa cabang tidak punya PT, jadi hanya pemegang scope seluruh PT
  // yang boleh menyentuhnya — sama seperti gerbang di sisi server.
  const canWrite = (companyId: string | null | undefined) =>
    writableCompanyIds === null || (!!companyId && writableCompanyIds.includes(companyId));

  // Tombol "tambah pengguna" hanya berguna kalau ada PT yang boleh diisi.
  const canCreate = writableCompanyIds === null || writableCompanyIds.length > 0;
  // Cabang & jabatan yang bisa dipilih saat membuat pengguna dibatasi ke PT
  // yang boleh ditulis, supaya form tidak menawarkan pilihan yang pasti ditolak API.
  const writableBranches = branches.filter((b) => canWrite(b.companyId));
  const writableCompanies = companies.filter((c) => canWrite(c.id));
  const writableRoles = roles.filter((r) => canWrite(r.companyId));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.phone, u.branch?.name, u.roleName]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [users, search]);

  return (
    <PageShell>
      <PageHeader
        title="Pengguna"
        description="Daftar seluruh pengguna sistem per cabang"
        icon={<IconUsers className="size-5" />}
        action={
          canCreate ? (
            <CreateUserSheet
              branches={writableBranches}
              companies={writableCompanies}
              roles={writableRoles}
            />
          ) : undefined
        }
      />

      {users.length === 0 ? (
        <SectionCard padded={false}>
          <EmptyState
            icon={<IconUsers className="size-5" />}
            title="Belum ada pengguna"
            description="Buat pengguna pertama untuk mulai mengatur akses cabang."
            action={
              canCreate ? (
                <CreateUserSheet
                  branches={writableBranches}
                  companies={writableCompanies}
                  roles={writableRoles}
                />
              ) : undefined
            }
          />
        </SectionCard>
      ) : (
        <SectionCard
          padded={false}
          toolbar={
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari nama, email, cabang..."
              />
              <span className="text-muted-foreground ml-auto text-xs">
                {filtered.length} dari {users.length} pengguna
              </span>
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Bergabung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      title="Tidak ada hasil"
                      description={`Tidak ada pengguna yang cocok dengan "${search}".`}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id} className={!u.isActive ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      {canOpenDetail ? (
                        <Link
                          href={`/dashboard/users/${u.id}`}
                          className="hover:text-primary underline-offset-4 hover:underline"
                        >
                          {u.name}
                        </Link>
                      ) : (
                        u.name
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.email}
                      {!u.emailVerified && (
                        <Badge variant="warning" className="ml-1.5">
                          belum verif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.branch ? (
                        <div className="flex items-center gap-1.5">
                          <span>{u.branch.name}</span>
                          {u.branch.company?.code && (
                            <Badge variant="outline">{u.branch.company.code}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.roleName ? (
                        <Badge variant="soft">{u.roleName}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.joinDate
                        ? new Date(u.joinDate).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "success" : "soft"}>
                        {u.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canWrite(u.branch?.companyId) && (
                        <UserActions
                          user={u}
                          branches={writableBranches}
                          companies={writableCompanies}
                          roles={writableRoles}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </PageShell>
  );
}
