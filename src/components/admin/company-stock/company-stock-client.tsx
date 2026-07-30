"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconBuilding,
  IconCoins,
  IconDiamond,
  IconBox,
  IconPlus,
} from "@tabler/icons-react";
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
import { SectionCard, EmptyState } from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { SegmentedFilter } from "@/components/admin/segmented-filter";
import { CompanyStockSheet } from "./company-stock-sheet";
import { CompanyStockActions } from "./company-stock-actions";

type StockItem = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  isActive: boolean;
  sortOrder: number;
};

type CompanyWithItems = {
  id: string;
  name: string;
  companyStockItems: StockItem[];
};

interface Props {
  companies: CompanyWithItems[];
  /**
   * PT yang boleh diubah; `null` berarti semua PT. Sengaja daftar, bukan satu
   * boolean: hak ubah bisa lebih sempit daripada hak lihat, dan tab PT di
   * halaman ini bisa berpindah.
   */
  writableCompanyIds: string[] | null;
}

export function CompanyStockClient({ companies, writableCompanyIds }: Props) {
  const [activeCompanyId, setActiveCompanyId] = useState(companies.length > 0 ? companies[0].id : "");

  // Hak ubah mengikuti PT yang sedang aktif. Server tetap menegakkan hal yang
  // sama di API — ini hanya agar UI-nya jujur.
  const canManage =
    !!activeCompanyId &&
    (writableCompanyIds === null || writableCompanyIds.includes(activeCompanyId));
  const [searchQuery, setSearchQuery] = useState("");

  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  const filteredItems = (activeCompany?.companyStockItems || []).filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      {companies.length === 0 ? (
        <SectionCard padded={false}>
          <EmptyState
            icon={<IconBuilding className="size-5" />}
            title="Belum ada PT aktif"
            description="Aktifkan perusahaan terlebih dahulu untuk mengelola stok tingkat PT."
          />
        </SectionCard>
      ) : (
        <SegmentedFilter
          aria-label="Pilih perusahaan"
          value={activeCompanyId}
          onChange={setActiveCompanyId}
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
        />
      )}

      <AnimatePresence mode="wait">
        {activeCompanyId && (
          <motion.div
            key={activeCompanyId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-card flex min-h-[400px] flex-col overflow-hidden rounded-xl border shadow-sm">
              <div className="bg-muted/30 flex flex-col justify-between gap-3 border-b px-5 py-3 md:flex-row md:items-center">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Cari item, kode, atau tipe..."
                />

                {canManage && (
                  <CompanyStockSheet
                    companyId={activeCompanyId}
                    trigger={
                      <Button size="sm" className="gap-2">
                        <IconPlus className="size-4" />
                        <span>Tambah Stok</span>
                      </Button>
                    }
                  />
                )}
              </div>

              <div className="flex-1 overflow-x-auto">
                {filteredItems.length === 0 ? (
                  <EmptyState
                    icon={<IconBox className="size-5" />}
                    title="Tidak ada item ditemukan"
                    description="Coba sesuaikan pencarian atau tambahkan item baru."
                  />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Kode</TableHead>
                        <TableHead className="w-24 text-center">Status</TableHead>
                        {canManage && <TableHead className="w-[80px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item, idx) => (
                        <TableRow
                          key={item.id}
                          className={`group hover:bg-muted/20 transition-colors ${!item.isActive && "opacity-50"}`}
                        >
                          <TableCell className="tabular text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex size-8 items-center justify-center rounded-lg border ${getTypeColor(item.type)}`}
                              >
                                {getTypeIcon(item.type)}
                              </div>
                              <span className="font-medium">{item.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="soft">{getTypeLabel(item.type)}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono">
                            {item.code || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center">
                              <Badge variant={item.isActive ? "success" : "soft"}>
                                {item.isActive ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </div>
                          </TableCell>
                          {canManage && (
                            <TableCell>
                              <div className="flex justify-end">
                                <CompanyStockActions item={item} companyId={activeCompanyId} />
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getTypeIcon(type: string) {
  switch (type) {
    case "CURRENCY":
      return <IconCoins className="size-4" />;
    case "LOGAM_MULIA":
      return <IconDiamond className="size-4" />;
    default:
      return <IconBox className="size-4" />;
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case "CURRENCY":
      return "Mata Uang";
    case "LOGAM_MULIA":
      return "Logam Mulia";
    default:
      return type;
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case "CURRENCY":
      return "text-info bg-info-muted border-info/20";
    case "LOGAM_MULIA":
      return "text-warning-foreground bg-warning-muted border-warning/25";
    default:
      return "text-muted-foreground bg-muted";
  }
}
