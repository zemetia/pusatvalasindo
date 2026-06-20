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

const TYPE_LABELS: Record<string, string> = {
  OPENING: "Stok Awal",
  BUY: "Beli",
  SELL: "Jual",
  TRANSFER_IN: "Terima Transfer",
  TRANSFER_OUT: "Kirim Transfer",
  ADJUSTMENT: "Koreksi",
};

const TYPE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPENING: "secondary",
  BUY: "default",
  SELL: "destructive",
  TRANSFER_IN: "default",
  TRANSFER_OUT: "destructive",
  ADJUSTMENT: "outline",
};

function fmtIDR(val: unknown): string {
  if (val == null) return "—";
  return Number(val.toString()).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export default async function MutasiStokPage() {
  const [mutations, branches, currencies] = await Promise.all([
    prisma.stockMutation.findMany({
      include: { branch: true, currency: true },
      orderBy: { createdAt: "desc" },
      take: 200,
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/stock-mata-uang">← Stok</Link>
            </Button>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-2xl font-semibold">Riwayat Mutasi Stok</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            200 mutasi terbaru
          </p>
        </div>
        <StockMutationSheet
          branches={serializedBranches}
          currencies={serializedCurrencies}
        />
      </div>

      {mutations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada riwayat mutasi</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Mata Uang</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Nilai IDR</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mutations.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {m.createdAt.toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>{m.branch.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.currency.code}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[m.type] ?? "outline"}>
                      {TYPE_LABELS[m.type] ?? m.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(m.quantity.toString()).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {m.rate ? Number(m.rate.toString()).toLocaleString("id-ID") : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {m.idrValue ? fmtIDR(m.idrValue) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {m.note ?? "—"}
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
