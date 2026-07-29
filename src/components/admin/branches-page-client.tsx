"use client";

import { useState } from "react";
import {
  IconMapPin,
  IconPhone,
  IconUsers,
  IconPackage,
  IconBuilding,
  IconRadar,
} from "@tabler/icons-react";
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
import { BranchSheet, BranchRow } from "./branch-sheet";
import { BranchActions } from "./branch-actions";

type Company = {
  id: string;
  name: string;
  code: string;
};

type BranchWithCount = BranchRow & {
  latitude?: number | null;
  longitude?: number | null;
  attendanceRadiusM?: number | null;
  _count: {
    users: number;
    stockItems: number;
  };
};

interface Props {
  companies: Company[];
  branches: BranchWithCount[];
}

export function BranchesPageClient({ companies, branches }: Props) {
  const [activeTab, setActiveTab] = useState(
    companies.length > 0 ? companies[0].id : "unassigned"
  );
  const unassignedBranches = branches.filter((b) => !b.companyId);

  if (companies.length === 0 && unassignedBranches.length === 0) {
    return (
      <SectionCard padded={false}>
        <EmptyState
          icon={<IconBuilding className="size-5" />}
          title="Belum ada data cabang atau perusahaan"
          description="Tambahkan perusahaan dan cabang untuk memulai."
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
          {unassignedBranches.length > 0 && (
            <TabsTrigger value="unassigned">Lainnya</TabsTrigger>
          )}
        </TabsList>
        <BranchSheet
          companies={companies}
          currentCompanyId={activeTab !== "unassigned" ? activeTab : undefined}
        />
      </div>

      {companies.map((c) => {
        const companyBranches = branches.filter((b) => b.companyId === c.id);

        return (
          <TabsContent key={c.id} value={c.id} className="mt-0">
            <BranchTable
              branches={companyBranches}
              companies={companies}
              currentCompanyId={c.id}
              emptyText={`Belum ada cabang di ${c.name}`}
            />
          </TabsContent>
        );
      })}

      {unassignedBranches.length > 0 && (
        <TabsContent value="unassigned" className="mt-0">
          <BranchTable
            branches={unassignedBranches}
            companies={companies}
            emptyText="Belum ada cabang tanpa perusahaan"
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

function BranchTable({
  branches,
  companies,
  currentCompanyId,
  emptyText,
}: {
  branches: BranchWithCount[];
  companies: Company[];
  currentCompanyId?: string;
  emptyText: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? branches.filter((b) =>
        [b.name, b.address, b.phone].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : branches;

  if (branches.length === 0) {
    return (
      <SectionCard padded={false}>
        <EmptyState
          icon={<IconBuilding className="size-5" />}
          title={emptyText}
          description="Tambahkan cabang baru atau pindahkan cabang dari perusahaan lain ke sini."
          action={<BranchSheet companies={companies} currentCompanyId={currentCompanyId} />}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      padded={false}
      toolbar={
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama atau alamat cabang..."
          />
          <span className="text-muted-foreground ml-auto text-xs">
            {filtered.length} dari {branches.length} cabang
          </span>
        </>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Cabang</TableHead>
            <TableHead>Telepon</TableHead>
            <TableHead>Geofence Absensi</TableHead>
            <TableHead className="text-right">Pengguna</TableHead>
            <TableHead className="text-right">Item Stok</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="p-0">
                <EmptyState
                  title="Tidak ada hasil"
                  description={`Tidak ada cabang yang cocok dengan "${search}".`}
                />
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((branch) => (
              <TableRow key={branch.id} className={!branch.isActive ? "opacity-60" : ""}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{branch.name}</span>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <IconMapPin className="size-3 shrink-0" />
                      <span className="max-w-[240px] truncate">
                        {branch.address ?? "Alamat belum diatur"}
                      </span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <IconPhone className="size-3.5" />
                    <span className="tabular font-mono">{branch.phone ?? "—"}</span>
                  </span>
                </TableCell>
                <TableCell>
                  {branch.latitude != null && branch.longitude != null ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-success inline-flex items-center gap-1.5 text-xs font-medium">
                        <IconRadar className="size-3.5" />
                        Radius {branch.attendanceRadiusM ?? 20} m
                      </span>
                      <span className="text-muted-foreground tabular font-mono text-[11px]">
                        {branch.latitude.toFixed(5)}, {branch.longitude.toFixed(5)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">Tidak aktif</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <IconUsers className="size-4" />
                    <span className="tabular text-foreground font-medium">
                      {branch._count.users}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <IconPackage className="size-4" />
                    <span className="tabular text-foreground font-medium">
                      {branch._count.stockItems}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={branch.isActive ? "success" : "soft"}>
                    {branch.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <BranchActions
                    companies={companies}
                    branch={{
                      id: branch.id,
                      name: branch.name,
                      address: branch.address,
                      phone: branch.phone,
                      isActive: branch.isActive,
                      companyId: branch.companyId,
                      latitude: branch.latitude,
                      longitude: branch.longitude,
                      attendanceRadiusM: branch.attendanceRadiusM,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
