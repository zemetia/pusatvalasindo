"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BankMutationSheet } from "@/components/admin/bank-mutation-sheet";

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
  branch: { name: string };
  currency: { code: string };
  mutations: Mutation[];
};

interface BankMutasiPageClientProps {
  account: Account;
}

export function BankMutasiPageClient({ account }: BankMutasiPageClientProps) {
  const balance = Number(account.balance);
  const currencyCode = account.currency.code;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/bank-accounts">← Rekening Bank</Link>
            </Button>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-2xl font-semibold">Riwayat Mutasi</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Cabang</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{account.branch.name}</p>
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
          <p className="text-sm mt-1">Gunakan tombol "+ Tambah Mutasi" untuk mencatat transaksi.</p>
        </div>
      ) : (
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
              {account.mutations.map((m) => (
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
