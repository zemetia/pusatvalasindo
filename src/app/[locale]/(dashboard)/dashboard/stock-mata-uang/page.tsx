import Link from "next/link";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StockMutationSheet } from "@/components/admin/stock-mutation-sheet";

function fmt(val: unknown): string {
  if (val == null) return "—";
  return Number(val.toString()).toLocaleString("id-ID");
}

function fmtRate(val: unknown): string {
  if (val == null) return "—";
  return Number(val.toString()).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export default async function StockMataUangPage() {
  const [stocks, branches, currencies] = await Promise.all([
    prisma.currencyStock.findMany({
      include: { branch: true, currency: true },
      orderBy: [{ branch: { name: "asc" } }, { currency: { code: "asc" } }],
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const serializedBranches = branches.map((b) => ({ id: b.id, name: b.name }));
  const serializedCurrencies = currencies.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stok Mata Uang</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Posisi stok per cabang dan mata uang
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/stock-mata-uang/mutasi">Riwayat Mutasi</Link>
          </Button>
          <StockMutationSheet
            branches={serializedBranches}
            currencies={serializedCurrencies}
          />
        </div>
      </div>

      {stocks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada data stok</p>
          <p className="text-sm mt-1">Tambahkan mutasi pertama untuk memulai pencatatan stok.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cabang</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Mata Uang</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Rate Beli</TableHead>
                <TableHead className="text-right">Rate Jual</TableHead>
                <TableHead>Diperbarui</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stocks.map((s) => {
                const qty = Number(s.quantity.toString());
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.branch.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.currency.code}</Badge>
                    </TableCell>
                    <TableCell>{s.currency.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={qty < 0 ? "text-destructive" : ""}>
                        {fmt(s.quantity)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmtRate(s.buyRate)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtRate(s.sellRate)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.updatedAt.toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
