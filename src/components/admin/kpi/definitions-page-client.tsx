"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconTrash, IconPencil, IconSearch } from "@tabler/icons-react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  KpiDefinitionSheet,
  KpiDefinitionRow,
  KPI_TYPE_LABELS,
} from "../kpi-definition-sheet";

export function DefinitionsPageClient({
  definitions,
}: {
  definitions: KpiDefinitionRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return definitions;
    return definitions.filter((d) =>
      [d.name, KPI_TYPE_LABELS[d.type] ?? d.type].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  }, [definitions, search]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/kpi-definitions/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menghapus");
    },
    onSuccess: () => {
      toast.success("Definisi KPI dihapus");
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Daftarkan nama KPI dan tipenya. Setiap KPI dapat dipakai oleh banyak
          jabatan.
        </p>
        <KpiDefinitionSheet trigger={<Button size="sm">+ Tambah</Button>} />
      </div>

      {definitions.length > 0 && (
        <div className="relative max-w-xs">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Cari nama atau tipe KPI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama KPI</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead className="text-right">Konfigurasi Jabatan</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {definitions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-10"
                >
                  Belum ada definisi KPI.
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Tidak ada hasil untuk &ldquo;{search}&rdquo;
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={d.type === "EVENT" ? "destructive" : "default"}
                    >
                      {KPI_TYPE_LABELS[d.type] ?? d.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {d._count.roleKpis}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <KpiDefinitionSheet
                        definition={d}
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
                            disabled={deleteMutation.isPending}
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        }
                        title={`Hapus definisi KPI "${d.name}"?`}
                        description="Tindakan ini tidak dapat dibatalkan."
                        onConfirm={() => handleDelete(d.id)}
                        loading={deleteMutation.isPending}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
