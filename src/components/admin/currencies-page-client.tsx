"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { PageHeader } from "@/components/admin/page-header";
import { IconCurrencyDollar, IconSearch } from "@tabler/icons-react";

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
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return currencies;
    return currencies.filter((c) =>
      [c.code, c.name, c.symbol].some((v) => v?.toLowerCase().includes(q))
    );
  }, [currencies, search]);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Mata Uang"
        description="Kelola daftar mata uang yang digunakan di seluruh cabang"
        icon={<IconCurrencyDollar className="size-5" />}
        action={<CurrencySheet />}
      />

      {currencies.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada mata uang</p>
          <p className="text-sm mt-1">Tambahkan mata uang pertama untuk memulai.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative max-w-xs">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Cari kode atau nama mata uang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

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
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Tidak ada hasil untuk &ldquo;{search}&rdquo;
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
