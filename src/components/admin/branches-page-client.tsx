"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconMapPin, IconPhone, IconUsers, IconPackage, IconBuilding, IconSearch } from "@tabler/icons-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { BranchSheet, BranchRow } from "./branch-sheet";
import { BranchActions } from "./branch-actions";
import { IconRadar } from "@tabler/icons-react";

type Company = {
  id: string;
  name: string;
  code: string;
};

type BranchWithCount = BranchRow & {
  latitude?: number | null;
  longitude?: number | null;
  attendanceRadiusM?: number | null;
  _count: {
    users: number;
    stockItems: number;
  };
};

interface Props {
  companies: Company[];
  branches: BranchWithCount[];
}

export function BranchesPageClient({ companies, branches }: Props) {
  const [activeTab, setActiveTab] = useState(companies.length > 0 ? companies[0].id : "unassigned");
  const unassignedBranches = branches.filter((b) => !b.companyId);

  if (companies.length === 0 && unassignedBranches.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Belum ada data cabang atau perusahaan</p>
        <p className="text-sm mt-1">Tambahkan perusahaan dan cabang untuk memulai.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <TabsList className="w-fit">
            {companies.map((c) => (
              <TabsTrigger key={c.id} value={c.id}>
                {c.name}
              </TabsTrigger>
            ))}
            {unassignedBranches.length > 0 && (
              <TabsTrigger value="unassigned">
                Lainnya
              </TabsTrigger>
            )}
          </TabsList>
          <BranchSheet companies={companies} currentCompanyId={activeTab !== "unassigned" ? activeTab : undefined} />
        </div>

        {companies.map((c) => {
          const companyBranches = branches.filter((b) => b.companyId === c.id);

          return (
            <TabsContent key={c.id} value={c.id} className="mt-0">
              <BranchTable branches={companyBranches} companies={companies} emptyText={`Belum ada cabang di ${c.name}`} />
            </TabsContent>
          );
        })}

        {unassignedBranches.length > 0 && (
          <TabsContent value="unassigned" className="mt-0">
            <BranchTable branches={unassignedBranches} companies={companies} emptyText="Belum ada cabang tanpa perusahaan" />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function BranchTable({ branches, companies, emptyText }: { branches: BranchWithCount[], companies: Company[], emptyText: string }) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? branches.filter((b) =>
        [b.name, b.address, b.phone].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : branches;

  if (branches.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/5 transition-colors hover:bg-muted/10"
      >
        <div className="p-4 rounded-full bg-muted/20 mb-4">
          <IconBuilding className="size-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground">{emptyText}</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs text-center">
          Tambahkan cabang baru atau pindahkan cabang dari perusahaan lain ke sini.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Cari nama atau alamat cabang..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-semibold">Nama Cabang</TableHead>
              <TableHead className="font-semibold">Informasi Kontak</TableHead>
              <TableHead className="font-semibold">Geofence Absensi</TableHead>
              <TableHead className="text-right font-semibold">Statistik</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Tidak ada hasil untuk &ldquo;{search}&rdquo;
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((branch) => (
                  <TableRow
                    key={branch.id}
                    className={`group transition-colors ${!branch.isActive ? "opacity-60 bg-muted/20" : "hover:bg-muted/30"}`}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-foreground tracking-tight">{branch.name}</span>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                          <IconMapPin className="size-3" />
                          {branch.address ? (
                            <span className="truncate max-w-[200px]">{branch.address}</span>
                          ) : (
                            "Alamat belum diatur"
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
                          <IconPhone className="size-3.5 text-primary/70" />
                          <span className="font-mono">{branch.phone ?? "—"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {branch.latitude != null && branch.longitude != null ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                            <IconRadar className="size-3.5" />
                            <span>Radius {branch.attendanceRadiusM ?? 20} m</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {branch.latitude.toFixed(5)}, {branch.longitude.toFixed(5)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">Tidak aktif</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-3">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <IconUsers className="size-3.5 text-blue-500/70" />
                            <span>{branch._count.users}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground uppercase">Pengguna</span>
                        </div>
                        <div className="flex flex-col items-end border-l pl-3 border-border/50">
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <IconPackage className="size-3.5 text-orange-500/70" />
                            <span>{branch._count.stockItems}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground uppercase">Stok</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={branch.isActive ? "default" : "outline"}
                        className={branch.isActive ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20" : "text-muted-foreground border-muted-foreground/30"}
                      >
                        <span className={`mr-1.5 size-1.5 rounded-full ${branch.isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"}`} />
                        {branch.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <BranchActions
                          companies={companies}
                          branch={{
                            id: branch.id,
                            name: branch.name,
                            address: branch.address,
                            phone: branch.phone,
                            isActive: branch.isActive,
                            companyId: branch.companyId,
                            latitude: branch.latitude,
                            longitude: branch.longitude,
                            attendanceRadiusM: branch.attendanceRadiusM,
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
