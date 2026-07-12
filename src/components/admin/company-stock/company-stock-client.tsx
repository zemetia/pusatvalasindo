"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconBuilding,
  IconCoins,
  IconDiamond,
  IconBox,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  canManage: boolean;
}

export function CompanyStockClient({ companies, canManage }: Props) {
  const [activeCompanyId, setActiveCompanyId] = useState(companies.length > 0 ? companies[0].id : "");
  const [searchQuery, setSearchQuery] = useState("");

  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  const filteredItems = (activeCompany?.companyStockItems || []).filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <IconBuilding className="size-4" />
          <span>Perusahaan (PT)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {companies.map((company) => (
            <button
              key={company.id}
              onClick={() => setActiveCompanyId(company.id)}
              className={`px-6 py-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-start gap-1 group ${
                activeCompanyId === company.id
                  ? "border-[#820302] bg-[#820302]/5 shadow-sm"
                  : "border-border/50 bg-card hover:border-border hover:bg-muted/50"
              }`}
            >
              <span
                className={`text-xs uppercase tracking-widest font-bold ${
                  activeCompanyId === company.id ? "text-[#820302]" : "text-muted-foreground"
                }`}
              >
                Perusahaan
              </span>
              <span
                className={`text-lg font-bold tracking-tight ${
                  activeCompanyId === company.id ? "text-foreground" : "text-foreground/70"
                }`}
              >
                {company.name}
              </span>
            </button>
          ))}
          {companies.length === 0 && (
            <div className="px-4 py-2 text-sm text-muted-foreground italic">
              Belum ada PT aktif
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeCompanyId && (
          <motion.div
            key={activeCompanyId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-card border rounded-2xl shadow-sm overflow-hidden min-h-[400px] flex flex-col">
              <div className="p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="relative w-full md:w-80 group">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-[#820302] transition-colors" />
                    <Input
                      placeholder="Cari item, kode, atau tipe..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 rounded-xl border-border/50 focus-visible:ring-[#820302]/20 focus-visible:border-[#820302] transition-all"
                    />
                  </div>
                </div>

                {canManage && (
                  <CompanyStockSheet
                    companyId={activeCompanyId}
                    trigger={
                      <Button className="rounded-xl bg-[#820302] hover:bg-[#820302]/90 shadow-lg shadow-[#820302]/20 flex gap-2">
                        <IconPlus className="size-4" />
                        <span>Tambah Stok</span>
                      </Button>
                    }
                  />
                )}
              </div>

              <div className="flex-1 overflow-x-auto">
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                    <IconBox className="size-12 mb-4 opacity-20" />
                    <p className="font-medium">Tidak ada item ditemukan</p>
                    <p className="text-xs uppercase tracking-widest mt-1">
                      Coba sesuaikan pencarian atau tambahkan item baru
                    </p>
                  </div>
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
                          <TableCell className="text-xs font-mono text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-lg bg-muted border border-border/50 group-hover:scale-110 transition-transform ${getTypeColor(item.type)}`}
                              >
                                {getTypeIcon(item.type)}
                              </div>
                              <span className="font-bold text-foreground tracking-tight">{item.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-semibold uppercase text-[10px] tracking-widest py-0.5">
                              {getTypeLabel(item.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
                            {item.code || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center">
                              <Badge
                                variant={item.isActive ? "default" : "outline"}
                                className={item.isActive ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : ""}
                              >
                                {item.isActive ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </div>
                          </TableCell>
                          {canManage && (
                            <TableCell>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
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
      return "text-blue-600 bg-blue-50";
    case "LOGAM_MULIA":
      return "text-amber-600 bg-amber-50";
    default:
      return "";
  }
}
