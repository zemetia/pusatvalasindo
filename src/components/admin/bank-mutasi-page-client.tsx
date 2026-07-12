"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BankMutationSheet } from "@/components/admin/bank-mutation-sheet";
import { IconSearch } from "@tabler/icons-react";

type Mutation = {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
};

type Account = {
  id: string;
  bankName: string;
  accountNumber: string | null;
  accountName: string;
  balance: string;
  isActive: boolean;
  company: { name: string };
  currency: { code: string };
  mutations: Mutation[];
};

interface BankMutasiPageClientProps {
  account: Account;
}

export function BankMutasiPageClient({ account }: BankMutasiPageClientProps) {
  const balance = Number(account.balance);
  const currencyCode = account.currency.code;
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return account.mutations;
    return account.mutations.filter((m) =>
      [m.description, m.type === "CREDIT" ? "masuk" : "keluar"].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  }, [account.mutations, search]);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
            <Link href="/dashboard/bank-accounts" className="hover:text-foreground transition-colors">Rekening Bank</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Riwayat Mutasi</span>
          </div>
          <h1 className="text-2xl font-semibold">Riwayat Mutasi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {account.bankName} — {account.accountNumber}
          </p>
        </div>
        {account.isActive && (
          <BankMutationSheet
            bankAccountId={account.id}
            bankName={account.bankName}
            accountNumber={account.accountNumber ?? ""}
            currencyCode={currencyCode}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">PT</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{account.company.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pemilik Rekening</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{account.accountName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Saat Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold font-mono">
              {currencyCode}{" "}
              {balance.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {account.mutations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada riwayat mutasi</p>
          <p className="text-sm mt-1">Gunakan tombol &ldquo;+ Tambah Mutasi&rdquo; untuk mencatat transaksi.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative max-w-xs">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Cari keterangan, tipe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="text-right">Saldo Setelah</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Tidak ada hasil untuk &ldquo;{search}&rdquo;
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.type === "CREDIT" ? "default" : "destructive"}>
                          {m.type === "CREDIT" ? "Masuk" : "Keluar"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={m.type === "CREDIT" ? "text-green-600" : "text-destructive"}>
                          {m.type === "CREDIT" ? "+" : "-"}
                          {Number(m.amount).toLocaleString("id-ID", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(m.balanceAfter).toLocaleString("id-ID", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {m.description ?? "—"}
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
