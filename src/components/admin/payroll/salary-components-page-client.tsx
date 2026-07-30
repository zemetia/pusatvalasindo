"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { IconTrash, IconPencil, IconCoin } from "@tabler/icons-react";
import {
  SalaryComponentSheet,
  type SalaryComponentRow,
} from "../salary-component-sheet";
import { formatCurrency } from "@/lib/kpi-utils";

type CompanyOption = { id: string; name: string };

export function SalaryComponentsPageClient({
  components,
  companies,
  canCreateGlobal,
  usageByComponent,
}: {
  components: SalaryComponentRow[];
  companies: CompanyOption[];
  canCreateGlobal: boolean;
  /** Berapa karyawan memakai tiap komponen — menentukan boleh dihapus atau tidak. */
  usageByComponent: Record<string, number>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return components;
    return components.filter((c) =>
      [c.name, c.note ?? "", c.companyName ?? "Semua PT"].some((v) =>
        v.toLowerCase().includes(q)
      )
    );
  }, [components, search]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/salary-components/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menghapus");
    },
    onSuccess: () => {
      toast.success("Komponen gaji dihapus");
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addButton = (
    <SalaryComponentSheet
      companies={companies}
      canCreateGlobal={canCreateGlobal}
      trigger={<Button size="sm">+ Tambah</Button>}
    />
  );

  return (
    <SectionCard
      padded={false}
      toolbar={
        <>
          {components.length > 0 && (
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari nama komponen atau PT..."
              />
              <span className="text-muted-foreground text-xs">
                {filtered.length} dari {components.length} komponen
              </span>
            </>
          )}
          <div className="ml-auto">{addButton}</div>
        </>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Komponen</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Berlaku Untuk</TableHead>
            <TableHead className="text-right">Nilai Default</TableHead>
            <TableHead className="text-right">Dipakai</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {components.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="p-0">
                <EmptyState
                  icon={<IconCoin className="size-5" />}
                  title="Belum ada komponen gaji tambahan"
                  description="Gaji pokok, uang makan, transport, jabatan, dan BPJS sudah baku di profil karyawan. Tambahkan komponen di sini untuk tunjangan atau potongan lain."
                  action={addButton}
                />
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="p-0">
                <EmptyState
                  title="Tidak ada hasil"
                  description={`Tidak ada komponen yang cocok dengan "${search}".`}
                />
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((c) => {
              const used = usageByComponent[c.id] ?? 0;
              return (
                <TableRow key={c.id} className={c.isActive ? undefined : "opacity-55"}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">
                        {c.name}
                        {!c.isActive && (
                          <span className="text-muted-foreground text-xs font-normal">
                            {" "}
                            · nonaktif
                          </span>
                        )}
                      </span>
                      {c.note && (
                        <span className="text-muted-foreground text-xs">{c.note}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.kind === "ALLOWANCE" ? "success" : "warning"}>
                      {c.kind === "ALLOWANCE" ? "Tunjangan" : "Potongan"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.companyName ?? "Semua PT"}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {c.defaultAmount === null ? "—" : formatCurrency(c.defaultAmount)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {used === 0 ? "—" : `${used} orang`}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <SalaryComponentSheet
                        component={c}
                        companies={companies}
                        canCreateGlobal={canCreateGlobal}
                        trigger={
                          <Button size="icon" variant="ghost">
                            <IconPencil className="size-4" />
                          </Button>
                        }
                      />
                      <DeleteConfirmDialog
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={used > 0 || deleteMutation.isPending}
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        }
                        title={`Hapus komponen "${c.name}"?`}
                        description="Tindakan ini tidak dapat dibatalkan. Komponen yang masih dipakai karyawan tidak bisa dihapus — nonaktifkan saja."
                        onConfirm={() => deleteMutation.mutate(c.id)}
                        loading={deleteMutation.isPending}
                      />
                    </div>
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
