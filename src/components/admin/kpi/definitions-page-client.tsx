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
import { IconTrash, IconPencil, IconListDetails } from "@tabler/icons-react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import type { KpiDefinitionRow } from "../kpi-definition-sheet";
import { KpiDefinitionSheet } from "../kpi-definition-sheet";
import { SCORING_TYPE_LABELS, INPUT_SOURCE_LABELS } from "@/lib/kpi-utils";

/** Warna badge mengikuti arti: penalti = peringatan, reward/target = positif. */
function scoringTone(scoringType: string) {
  if (scoringType.startsWith("PENALTY") || scoringType === "TOLERANCE_LIMIT") return "warning";
  if (scoringType === "REWARD_POINT") return "success";
  return "info";
}

function sourceTone(source: string) {
  if (source === "SELF") return "success";
  if (source === "SYSTEM") return "secondary";
  return "outline";
}

export function DefinitionsPageClient({ definitions }: { definitions: KpiDefinitionRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return definitions;
    return definitions.filter((d) =>
      [
        d.name,
        d.code,
        d.description ?? "",
        SCORING_TYPE_LABELS[d.scoringType] ?? d.scoringType,
        INPUT_SOURCE_LABELS[d.defaultInputSource] ?? d.defaultInputSource,
      ].some((v) => v?.toLowerCase().includes(q))
    );
  }, [definitions, search]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/kpi-definitions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menghapus");
    },
    onSuccess: () => {
      toast.success("Definisi KPI dihapus");
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <SectionCard
      padded={false}
      toolbar={
        <>
          {definitions.length > 0 && (
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari nama, aturan, atau cara penilaian..."
              />
              <span className="text-muted-foreground text-xs">
                {filtered.length} dari {definitions.length} KPI
              </span>
            </>
          )}
          <div className="ml-auto">
            <KpiDefinitionSheet trigger={<Button size="sm">+ Tambah</Button>} />
          </div>
        </>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>KPI</TableHead>
            <TableHead>Cara Penilaian</TableHead>
            <TableHead>Diisi Oleh</TableHead>
            <TableHead className="text-right">Jabatan</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {definitions.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="p-0">
                <EmptyState
                  icon={<IconListDetails className="size-5" />}
                  title="Belum ada definisi KPI"
                  description="Tambahkan definisi pertama sebelum menyusun KPI per jabatan."
                  action={<KpiDefinitionSheet trigger={<Button size="sm">+ Tambah</Button>} />}
                />
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="p-0">
                <EmptyState
                  title="Tidak ada hasil"
                  description={`Tidak ada KPI yang cocok dengan "${search}".`}
                />
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((d) => (
              <TableRow key={d.id} className={d.isActive ? undefined : "opacity-55"}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {d.name}
                      {!d.isActive && (
                        <span className="text-muted-foreground text-xs font-normal"> · nonaktif</span>
                      )}
                    </span>
                    {d.description && (
                      <span className="text-muted-foreground text-xs">{d.description}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={scoringTone(d.scoringType)}>
                    {SCORING_TYPE_LABELS[d.scoringType] ?? d.scoringType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={sourceTone(d.defaultInputSource)}>
                      {INPUT_SOURCE_LABELS[d.defaultInputSource] ?? d.defaultInputSource}
                    </Badge>
                    {d.defaultRequiresApproval && d.defaultInputSource === "SELF" && (
                      <span className="text-muted-foreground text-[11px]">
                        perlu persetujuan{d.defaultRequiresEvidence ? " + bukti" : ""}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="tabular text-right">{d._count.roleKpis}</TableCell>
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
                      description={
                        d._count.roleKpis > 0
                          ? `KPI ini dipakai ${d._count.roleKpis} jabatan. Menghapusnya ikut menghapus seluruh entri KPI yang tercatat di bawahnya.`
                          : "Tindakan ini tidak dapat dibatalkan."
                      }
                      onConfirm={() => deleteMutation.mutate(d.id)}
                      loading={deleteMutation.isPending}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
