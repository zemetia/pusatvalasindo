"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BankMutationSheet } from "@/components/admin/bank-mutation-sheet";
import {
  PageShell,
  PageHeader,
  SectionCard,
  EmptyState,
  MetricBlock,
  MetricInline,
} from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { IconArrowLeft } from "@tabler/icons-react";

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
    <PageShell>
      <PageHeader
        eyebrow="Rekening Bank"
        title="Riwayat Mutasi"
        description={`${account.bankName} — ${account.accountNumber ?? "tanpa nomor"}`}
        icon={
          <Link
            href="/dashboard/bank-accounts"
            aria-label="Kembali ke daftar rekening"
            className="hover:text-foreground flex size-full items-center justify-center"
          >
            <IconArrowLeft className="size-5" />
          </Link>
        }
        action={
          account.isActive && (
            <BankMutationSheet
              bankAccountId={account.id}
              bankName={account.bankName}
              accountNumber={account.accountNumber ?? ""}
              currencyCode={currencyCode}
            />
          )
        }
      />

      <section className="border-border grid gap-8 border-y py-8 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <MetricBlock
            label="Saldo Saat Ini"
            size="hero"
            prefix={currencyCode}
            value={balance.toLocaleString("id-ID", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            meta={
              account.isActive ? "Rekening aktif" : "Rekening nonaktif"
            }
          />
        </div>
        <div className="space-y-2.5 sm:border-l sm:pl-8">
          <MetricInline label="PT" value={account.company.name} />
          <MetricInline label="Pemilik Rekening" value={account.accountName} />
          <MetricInline
            label="Jumlah Mutasi"
            value={account.mutations.length.toLocaleString("id-ID")}
          />
        </div>
      </section>

      {account.mutations.length === 0 ? (
        <SectionCard padded={false}>
          <EmptyState
            title="Belum ada riwayat mutasi"
            description="Gunakan tombol “Tambah Mutasi” untuk mencatat transaksi pertama."
          />
        </SectionCard>
      ) : (
        <SectionCard
          padded={false}
          toolbar={
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari keterangan, tipe..."
              />
              <span className="text-muted-foreground ml-auto text-xs">
                {filtered.length} dari {account.mutations.length} mutasi
              </span>
            </>
          }
        >
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
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      title="Tidak ada hasil"
                      description={`Tidak ada mutasi yang cocok dengan "${search}".`}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.type === "CREDIT" ? "success" : "danger"}>
                        {m.type === "CREDIT" ? "Masuk" : "Keluar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      <span
                        className={m.type === "CREDIT" ? "text-success" : "text-destructive"}
                      >
                        {m.type === "CREDIT" ? "+" : "-"}
                        {Number(m.amount).toLocaleString("id-ID", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {Number(m.balanceAfter).toLocaleString("id-ID", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[240px] truncate">
                      {m.description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </PageShell>
  );
}
