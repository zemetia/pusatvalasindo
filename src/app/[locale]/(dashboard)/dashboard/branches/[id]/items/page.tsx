import { notFound } from "next/navigation";
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
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[branches/[id]/items/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }
  const [branch, items, companies] = result;

  if (!branch) notFound();

  const branches = [{ id: branch.id, name: branch.name, companyId: branch.companyId }];

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
            <Link href="/dashboard/branches" className="hover:text-foreground transition-colors">Cabang</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{branch.name}</span>
          </div>
          <h1 className="text-2xl font-semibold">Item Stok — {branch.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola item stok untuk cabang ini</p>
        </div>
        <StockItemSheet branches={branches} companies={companies} defaultBranchId={branch.id} />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada item stok</p>
          <p className="text-sm mt-1">Tambahkan item pertama untuk cabang ini.</p>
        </div>
      ) : (
        <div className="rounded-md border">
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
                <TableRow key={item.id} className={!item.isActive ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {item.code ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {TYPE_LABELS[item.type] ?? item.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{item.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "default" : "outline"}>
                      {item.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StockItemActions
                      item={{
                        id: item.id,
                        branchId: item.branchId,
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
        </div>
      )}
    </div>
  );
}
