"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CurrencySheet } from "@/components/admin/currency-sheet";
import { CurrencyActions } from "@/components/admin/currency-actions";

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  isActive: boolean;
  _count: { stocks: number; bankAccounts: number };
};

interface CurrenciesPageClientProps {
  currencies: Currency[];
}

export function CurrenciesPageClient({ currencies }: CurrenciesPageClientProps) {
  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mata Uang</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola daftar mata uang yang digunakan di seluruh cabang
          </p>
        </div>
        <CurrencySheet />
      </div>

      {currencies.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada mata uang</p>
          <p className="text-sm mt-1">Tambahkan mata uang pertama untuk memulai.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Simbol</TableHead>
                <TableHead className="text-right">Stok Aktif</TableHead>
                <TableHead className="text-right">Rekening</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.map((c) => (
                <TableRow key={c.id} className={!c.isActive ? "opacity-50" : ""}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{c.code}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.symbol ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {c._count.stocks}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {c._count.bankAccounts}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? "default" : "outline"}>
                      {c.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <CurrencyActions
                      currency={{
                        id: c.id,
                        code: c.code,
                        name: c.name,
                        symbol: c.symbol,
                        isActive: c.isActive,
                      }}
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
