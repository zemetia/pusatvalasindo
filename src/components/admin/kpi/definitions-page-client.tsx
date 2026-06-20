"use client";

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
import { IconTrash, IconPencil } from "@tabler/icons-react";
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

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Hapus definisi KPI "${name}"?`)) return;
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
            ) : (
              definitions.map((d) => (
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
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(d.id, d.name)}
                      >
                        <IconTrash className="size-4" />
                      </Button>
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
