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
import { StockItemSheet } from "@/components/admin/stock-item-sheet";
import { StockItemActions } from "@/components/admin/stock-item-actions";
import { PageHeader } from "@/components/admin/page-header";
import { IconPackage, IconSearch } from "@tabler/icons-react";

const TYPE_LABELS: Record<string, string> = {
  CURRENCY: "Mata Uang",
  GOLD: "Emas",
  CASH: "Kas",
};

type Branch = { id: string; name: string; companyId: string | null };
type Company = { id: string; name: string };

type StockItem = {
  id: string;
  branchId: string | null;
  name: string;
  code: string | null;
  type: string;
  sortOrder: number;
  isActive: boolean;
  branch: { id: string; name: string } | null;
};

interface StockItemsPageClientProps {
  items: StockItem[];
  branches: Branch[];
  companies: Company[];
}

export function StockItemsPageClient({ items, branches, companies }: StockItemsPageClientProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.name, item.code, item.branch?.name, TYPE_LABELS[item.type] ?? item.type]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [items, search]);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Stok Barang"
        description="Daftar seluruh item stok per cabang"
        icon={<IconPackage className="size-5" />}
        action={<StockItemSheet branches={branches} companies={companies} />}
      />

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada item stok</p>
          <p className="text-sm mt-1">Tambahkan item pertama untuk memulai.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative max-w-xs">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Cari nama, kode, cabang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

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
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Tidak ada hasil untuk &ldquo;{search}&rdquo;
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id} className={!item.isActive ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {item.code ?? "—"}
                      </TableCell>
                      <TableCell>{item.branch?.name ?? "Tanpa Cabang"}</TableCell>
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
