"use client";

import { useState } from "react";
import { IconBuildingSkyscraper, IconBuilding, IconUsers, IconId } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SectionCard,
  EmptyState,
  MetricRow,
  MetricBlock,
} from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { CompanySheet } from "./company-sheet";
import { CompanyActions } from "./company-actions";

export type CompanyListRow = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  branchCount: number;
  roleCount: number;
  userCount: number;
};

interface Props {
  companies: CompanyListRow[];
  /** Boleh menambah/mengubah/menghapus PT — resource `companies`, aksi tulis. */
  canManage: boolean;
}

const nf = new Intl.NumberFormat("id-ID");

export function CompaniesPageClient({ companies, canManage }: Props) {
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = q
    ? companies.filter((c) => [c.name, c.code].some((v) => v.toLowerCase().includes(q)))
    : companies;

  const activeCount = companies.filter((c) => c.isActive).length;
  const totalBranches = companies.reduce((s, c) => s + c.branchCount, 0);
  const totalUsers = companies.reduce((s, c) => s + c.userCount, 0);

  return (
    <div className="flex flex-col gap-8">
      <MetricRow columns={4}>
        <MetricBlock
          label="Total PT"
          value={nf.format(companies.length)}
          meta={`${nf.format(activeCount)} aktif`}
        />
        <MetricBlock label="PT Nonaktif" value={nf.format(companies.length - activeCount)} />
        <MetricBlock label="Cabang" value={nf.format(totalBranches)} meta="Seluruh PT" />
        <MetricBlock label="Pengguna" value={nf.format(totalUsers)} meta="Melalui cabangnya" />
      </MetricRow>

      {companies.length === 0 ? (
        <SectionCard padded={false}>
          <EmptyState
            icon={<IconBuildingSkyscraper className="size-5" />}
            title="Belum ada PT"
            description="Tambahkan badan usaha untuk mulai mendaftarkan cabang dan karyawan."
            action={canManage ? <CompanySheet /> : undefined}
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
                placeholder="Cari nama atau kode PT..."
              />
              <span className="text-muted-foreground ml-auto text-xs">
                {filtered.length} dari {companies.length} PT
              </span>
              {canManage && <CompanySheet />}
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama PT</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead className="text-right">Cabang</TableHead>
                <TableHead className="text-right">Jabatan</TableHead>
                <TableHead className="text-right">Pengguna</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={canManage ? 7 : 6} className="p-0">
                    <EmptyState
                      title="Tidak ada hasil"
                      description={`Tidak ada PT yang cocok dengan "${search}".`}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((company) => (
                  <TableRow key={company.id} className={!company.isActive ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>
                      <span className="tabular font-mono text-xs">{company.code}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground inline-flex items-center gap-1.5">
                        <IconBuilding className="size-4" />
                        <span className="tabular text-foreground font-medium">
                          {nf.format(company.branchCount)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground inline-flex items-center gap-1.5">
                        <IconId className="size-4" />
                        <span className="tabular text-foreground font-medium">
                          {nf.format(company.roleCount)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground inline-flex items-center gap-1.5">
                        <IconUsers className="size-4" />
                        <span className="tabular text-foreground font-medium">
                          {nf.format(company.userCount)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={company.isActive ? "success" : "soft"}>
                        {company.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <CompanyActions
                          company={{
                            id: company.id,
                            name: company.name,
                            code: company.code,
                            isActive: company.isActive,
                          }}
                          dependents={
                            company.branchCount + company.roleCount + company.userCount
                          }
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </div>
  );
}
