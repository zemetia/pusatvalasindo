"use client";

import { useState } from "react";
import { IconShieldLock, IconUsers } from "@tabler/icons-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionCard, EmptyState } from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { RoleSheet, RoleRow } from "./role-sheet";
import { RoleActions } from "./role-actions";

type Company = {
  id: string;
  name: string;
  code: string;
};

type RoleWithCount = RoleRow & {
  _count: {
    users: number;
  };
};

interface Props {
  companies: Company[];
  roles: RoleWithCount[];
}

/** Jumlah hak akses yang ditampilkan penuh sebelum diringkas jadi "+N". */
const PERMISSION_PREVIEW = 4;

export function RolesPageClient({ companies, roles }: Props) {
  const [activeTab, setActiveTab] = useState(
    companies.length > 0 ? companies[0].id : "unassigned"
  );
  const unassignedRoles = roles.filter((r) => !r.companyId);

  if (companies.length === 0 && unassignedRoles.length === 0) {
    return (
      <SectionCard padded={false}>
        <EmptyState
          icon={<IconShieldLock className="size-5" />}
          title="Belum ada role terdaftar"
          description="Tambahkan perusahaan terlebih dahulu sebelum mulai mengelola hak akses dan role."
        />
      </SectionCard>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <TabsList>
          {companies.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.name}
            </TabsTrigger>
          ))}
          {unassignedRoles.length > 0 && (
            <TabsTrigger value="unassigned">Sistem / Global</TabsTrigger>
          )}
        </TabsList>

        <RoleSheet
          currentCompanyId={activeTab !== "unassigned" ? activeTab : undefined}
          companies={companies}
        />
      </div>

      {companies.map((c) => {
        const companyRoles = roles.filter((r) => r.companyId === c.id);

        return (
          <TabsContent key={c.id} value={c.id} className="mt-0 focus-visible:outline-none">
            <RoleTable
              roles={companyRoles}
              currentCompanyId={c.id}
              companies={companies}
              emptyText={`Belum ada custom role untuk ${c.name}`}
            />
          </TabsContent>
        );
      })}

      {unassignedRoles.length > 0 && (
        <TabsContent value="unassigned" className="mt-0 focus-visible:outline-none">
          <RoleTable
            roles={unassignedRoles}
            currentCompanyId={undefined}
            companies={companies}
            emptyText="Belum ada role sistem/global"
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

function RoleTable({
  roles,
  currentCompanyId,
  companies,
  emptyText,
}: {
  roles: RoleWithCount[];
  currentCompanyId?: string;
  companies: Company[];
  emptyText: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? roles.filter((r) =>
        [r.name, r.description].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : roles;

  if (roles.length === 0) {
    return (
      <SectionCard padded={false}>
        <EmptyState
          icon={<IconShieldLock className="size-5" />}
          title={emptyText}
          description="Tambahkan role baru untuk mengelompokkan hak akses pengguna berdasarkan tanggung jawabnya."
          action={<RoleSheet currentCompanyId={currentCompanyId} companies={companies} />}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      padded={false}
      toolbar={
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama role..." />
          <span className="text-muted-foreground ml-auto text-xs">
            {filtered.length} dari {roles.length} role
          </span>
        </>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Hak Akses</TableHead>
            <TableHead className="text-right">Pengguna</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="p-0">
                <EmptyState
                  title="Tidak ada hasil"
                  description={`Tidak ada role yang cocok dengan "${search}".`}
                />
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((role) => {
              const shown = role.permissions.slice(0, PERMISSION_PREVIEW);
              const rest = role.permissions.length - shown.length;

              return (
                <TableRow key={role.id} className="align-top">
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{role.name}</span>
                      <span className="text-muted-foreground max-w-[320px] text-xs leading-relaxed whitespace-normal">
                        {role.description || "Tidak ada deskripsi"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex max-w-[420px] flex-wrap gap-1.5 whitespace-normal">
                      {role.permissions.length > 0 ? (
                        <>
                          {shown.map((p) => (
                            <Badge key={p} variant="soft" className="font-mono text-[10px]">
                              {p}
                            </Badge>
                          ))}
                          {rest > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              title={role.permissions.slice(PERMISSION_PREVIEW).join(", ")}
                            >
                              +{rest} lagi
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">Tanpa hak akses</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <IconUsers className="size-4" />
                      <span className="tabular text-foreground font-medium">
                        {role._count.users}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <RoleActions
                      role={role}
                      currentCompanyId={currentCompanyId}
                      companies={companies}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
