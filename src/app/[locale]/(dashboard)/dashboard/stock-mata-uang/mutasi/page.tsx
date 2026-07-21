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
  let result;
  try {
    result = await Promise.all([
      prisma.stockMutation.findMany({
        include: { branch: true, currency: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[stock-mata-uang/mutasi/page — fetch error]\n\n${msg}`}
        </pre>
      </div>
    )
  }
  const [mutations, branches, currencies] = result;

  const serializedBranches = branches.map((b) => ({ id: b.id, name: b.name }));
  const serializedCurrencies = currencies.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
            <Link href="/dashboard/stock-mata-uang" className="hover:text-foreground transition-colors">Stok Mata Uang</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Riwayat Mutasi</span>
          </div>
          <h1 className="text-2xl font-semibold">Riwayat Mutasi Stok</h1>
          <p className="text-sm text-muted-foreground mt-0.5">200 mutasi terbaru</p>
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
                  <TableCell>{m.branch?.name ?? "Tanpa Cabang"}</TableCell>
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
