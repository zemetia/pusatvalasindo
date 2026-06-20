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

export default async function StockItemsPage() {
  const [items, branches, companies] = await Promise.all([
    prisma.stockItem.findMany({
      include: { branch: { select: { id: true, name: true } } },
      orderBy: [{ branch: { name: "asc" } }, { type: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.branch.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stok Barang</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daftar seluruh item stok per cabang
          </p>
        </div>
        <StockItemSheet branches={branches} companies={companies} />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada item stok</p>
          <p className="text-sm mt-1">Tambahkan item pertama untuk memulai.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Cabang</TableHead>
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
                  <TableCell>{item.branch.name}</TableCell>
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
