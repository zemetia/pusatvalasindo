"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconCoins, IconCurrencyDollar } from "@tabler/icons-react";
import {
  PageShell,
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { SegmentedFilter } from "@/components/admin/segmented-filter";
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
import { EM_DASH, formatRate } from "@/lib/format";
import { CurrencySheet } from "./currency-sheet";
import { CurrencyActions } from "./currency-actions";

export type CurrencyListRow = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  isActive: boolean;
  buyPrice: number | null;
  sellPrice: number | null;
};

interface Props {
  currencies: CurrencyListRow[];
  canManage: boolean;
  /** Halaman Harga Valas, sudah berprefix locale. Null bila tidak berhak. */
  pricePageHref: string | null;
}

type StatusFilter = "all" | "active" | "inactive";

export function CurrenciesPageClient({ currencies, canManage, pricePageHref }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return currencies
      .filter((c) => {
        if (status === "active" && !c.isActive) return false;
        if (status === "inactive" && c.isActive) return false;
        if (!q) return true;
        return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
      })
      // Yang aktif dulu; yang nonaktif turun ke bawah supaya tidak menyela
      // daftar mata uang yang benar-benar dipakai sehari-hari.
      .sort((a, b) => Number(b.isActive) - Number(a.isActive));
  }, [currencies, search, status]);

  const activeCount = currencies.filter((c) => c.isActive).length;

  return (
    <PageShell>
      <PageHeader
        title="Mata Uang"
        description="Master mata uang yang dipakai seluruh modul valas — stok, rekening bank, dan Harga Valas."
        icon={<IconCoins className="size-5" />}
        action={
          <>
            {pricePageHref && (
              <Button variant="outline" size="sm" asChild>
                <Link href={pricePageHref}>
                  <IconCurrencyDollar className="size-4" />
                  Harga Valas
                </Link>
              </Button>
            )}
            {canManage && <CurrencySheet />}
          </>
        }
      />

      <SectionCard
        padded={false}
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari kode atau nama mata uang..."
            />
            <SegmentedFilter
              aria-label="Filter status mata uang"
              value={status}
              onChange={(v) => setStatus(v as StatusFilter)}
              options={[
                { value: "all", label: `Semua (${currencies.length})` },
                { value: "active", label: `Aktif (${activeCount})` },
                {
                  value: "inactive",
                  label: `Nonaktif (${currencies.length - activeCount})`,
                },
              ]}
            />
            <span className="text-muted-foreground ml-auto text-xs">
              {filtered.length} dari {currencies.length} mata uang
            </span>
          </>
        }
      >
        {currencies.length === 0 ? (
          <EmptyState
            icon={<IconCoins className="size-5" />}
            title="Belum ada mata uang"
            description="Tambahkan mata uang pertama untuk mulai mencatat stok dan harga valas."
            action={canManage ? <CurrencySheet /> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Simbol</TableHead>
                <TableHead className="text-right">Harga Beli</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={canManage ? 7 : 6} className="p-0">
                    <EmptyState
                      title="Tidak ada hasil"
                      description="Ubah kata kunci atau filter statusnya."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className={!c.isActive ? "opacity-60" : ""}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {c.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono">
                      {c.symbol ?? EM_DASH}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatRate(c.buyPrice)}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatRate(c.sellPrice)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.isActive ? "success" : "soft"}>
                        {c.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <CurrencyActions currency={c} />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </PageShell>
  );
}
