import { notFound } from "next/navigation";
import {
  PageShell,
  PageHeader,
  SectionCard,
  EmptyState,
  ErrorPanel,
} from "@/components/admin/page-shell";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
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
import { StockItemSheet } from "@/components/admin/stock-item-sheet";
import { StockItemActions } from "@/components/admin/stock-item-actions";

const TYPE_LABELS: Record<string, string> = {
  CURRENCY: "Mata Uang",
  GOLD: "Emas",
  CASH: "Kas",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BranchItemsPage({ params }: PageProps) {
  const { id } = await params;

  let result;
  try {
    result = await Promise.all([
      prisma.branch.findUnique({
        where: { id },
        select: { id: true, name: true, companyId: true },
      }),
      prisma.stockItem.findMany({
        where: { branchId: id },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.company.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <ErrorPanel source="branches/[id]/items/page" message={msg} />
    )
  }
  const [branch, items, companies] = result;

  if (!branch) notFound();

  const branches = [{ id: branch.id, name: branch.name, companyId: branch.companyId }];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Cabang"
        title={`Item Stok — ${branch.name}`}
        description="Kelola item stok untuk cabang ini"
        icon={
          <Link
            href="/dashboard/branches"
            aria-label="Kembali ke daftar cabang"
            className="hover:text-foreground flex size-full items-center justify-center"
          >
            <IconArrowLeft className="size-5" />
          </Link>
        }
        action={
          <StockItemSheet branches={branches} companies={companies} defaultBranchId={branch.id} />
        }
      />

      {items.length === 0 ? (
        <SectionCard padded={false}>
          <EmptyState
            title="Belum ada item stok"
            description="Tambahkan item pertama untuk cabang ini."
            action={
              <StockItemSheet
                branches={branches}
                companies={companies}
                defaultBranchId={branch.id}
              />
            }
          />
        </SectionCard>
      ) : (
        <SectionCard padded={false}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Urutan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className={!item.isActive ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono">
                    {item.code ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="soft">{TYPE_LABELS[item.type] ?? item.type}</Badge>
                  </TableCell>
                  <TableCell className="tabular text-right">{item.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "success" : "soft"}>
                      {item.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StockItemActions
                      item={{
                        id: item.id,
                        branchId: item.branchId ?? "",
                        name: item.name,
                        code: item.code,
                        type: item.type,
                        sortOrder: item.sortOrder,
                        isActive: item.isActive,
                      }}
                      branches={branches}
                      companies={companies}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </PageShell>
  );
}
