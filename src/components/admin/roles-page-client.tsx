"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconShieldLock, IconUsers, IconSearch, IconBuilding } from "@tabler/icons-react";
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
import { RoleSheet, RoleRow } from "./role-sheet";
import { RoleActions } from "./role-actions";

type Company = {
  id: string;
  name: string;
  code: string;
};

type RoleWithCount = RoleRow & {
  _count: {
    users: number;
  };
};

interface Props {
  companies: Company[];
  roles: RoleWithCount[];
}

export function RolesPageClient({ companies, roles }: Props) {
  const [activeTab, setActiveTab] = useState(companies.length > 0 ? companies[0].id : "unassigned");
  const unassignedRoles = roles.filter((r) => !r.companyId);

  if (companies.length === 0 && unassignedRoles.length === 0) {
    return (
      <div className="text-center py-24 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
        <div className="inline-flex p-4 rounded-full bg-white shadow-sm border border-slate-100 mb-6 text-slate-400">
          <IconShieldLock className="size-10" />
        </div>
        <p className="text-xl font-bold text-slate-900 tracking-tight">Belum Ada Role Terdaftar</p>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
          Silakan tambahkan perusahaan terlebih dahulu sebelum mulai mengelola hak akses dan role.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="w-fit h-12 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/50">
            {companies.map((c) => (
              <TabsTrigger
                key={c.id}
                value={c.id}
                className="rounded-xl px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-bold text-[13px] tracking-tight"
              >
                {c.name}
              </TabsTrigger>
            ))}
            {unassignedRoles.length > 0 && (
              <TabsTrigger
                value="unassigned"
                className="rounded-xl px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-bold text-[13px] tracking-tight"
              >
                Sistem / Global
              </TabsTrigger>
            )}
          </TabsList>

          <RoleSheet currentCompanyId={activeTab !== "unassigned" ? activeTab : undefined} companies={companies} />
        </div>

        {companies.map((c) => {
          const companyRoles = roles.filter((r) => r.companyId === c.id);

          return (
            <TabsContent key={c.id} value={c.id} className="mt-0 focus-visible:outline-none">
              <RoleTable roles={companyRoles} currentCompanyId={c.id} companies={companies} emptyText={`Belum ada custom role untuk ${c.name}`} />
            </TabsContent>
          );
        })}

        {unassignedRoles.length > 0 && (
          <TabsContent value="unassigned" className="mt-0 focus-visible:outline-none">
            <RoleTable roles={unassignedRoles} currentCompanyId={undefined} companies={companies} emptyText="Belum ada role sistem/global" />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function RoleTable({ roles, currentCompanyId, companies, emptyText }: { roles: RoleWithCount[], currentCompanyId?: string, companies: Company[], emptyText: string }) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? roles.filter((r) =>
        [r.name, r.description].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : roles;

  if (roles.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 border border-dashed rounded-3xl bg-slate-50/40 transition-colors hover:bg-slate-50"
      >
        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm mb-6">
          <IconShieldLock className="size-10 text-slate-300" />
        </div>
        <p className="text-lg font-bold text-slate-900 tracking-tight">{emptyText}</p>
        <p className="text-[13px] text-slate-500 mt-2 max-w-xs text-center leading-relaxed">
          Tambahkan role baru untuk mengelompokkan hak akses pengguna berdasarkan tanggung jawab mereka.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
        <Input
          type="search"
          placeholder="Cari nama role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="rounded-3xl border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-200">
              <TableHead className="font-bold text-slate-900 h-14 pl-6 uppercase text-[11px] tracking-widest">Detail Role</TableHead>
              <TableHead className="font-bold text-slate-900 h-14 uppercase text-[11px] tracking-widest">Hak Akses</TableHead>
              <TableHead className="text-right font-bold text-slate-900 h-14 uppercase text-[11px] tracking-widest">Pengguna</TableHead>
              <TableHead className="w-[100px] h-14 pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                  Tidak ada hasil untuk &ldquo;{search}&rdquo;
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((role) => (
                  <TableRow
                    key={role.id}
                    className="group border-slate-100 transition-colors hover:bg-slate-50/30"
                  >
                    <TableCell className="py-5 pl-6">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900 tracking-tight text-[15px]">{role.name}</span>
                        <span className="text-[12px] text-slate-500 leading-relaxed max-w-[300px]">
                          {role.description || "Tidak ada deskripsi"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="flex flex-wrap gap-1.5 max-w-[400px]">
                        {role.permissions.length > 0 ? (
                          role.permissions.map((p) => (
                            <Badge
                              key={p}
                              variant="secondary"
                              className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight"
                            >
                              {p.replace(/_/g, ' ')}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Tanpa Hak Akses</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-5 text-right">
                      <div className="flex items-center justify-end gap-2 text-[15px] font-bold text-slate-900">
                        <IconUsers className="size-4 text-primary/60" />
                        <span>{role._count.users}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Personel</p>
                    </TableCell>
                    <TableCell className="py-5 pr-6">
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-x-2 group-hover:translate-x-0">
                        <RoleActions
                          role={role}
                          currentCompanyId={currentCompanyId}
                          companies={companies}
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
