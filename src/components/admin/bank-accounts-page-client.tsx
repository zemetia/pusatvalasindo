"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BankAccountSheet, BankAccountData } from "@/components/admin/bank-account-sheet";
import { BankMutationSheet } from "@/components/admin/bank-mutation-sheet";
import { PageHeader } from "@/components/admin/page-header";
import { IconBuildingBank, IconSearch, IconPower } from "@tabler/icons-react";

type SerializedCurrency = { id: string; code: string; name: string };
type Company = { id: string; name: string };

type BankAccount = {
  id: string;
  companyId: string;
  bankName: string;
  accountNumber: string | null;
  accountName: string;
  currencyId: string;
  note: string | null;
  balance: string;
  isActive: boolean;
  company: { name: string };
  currency: { code: string };
};

function fmtBalance(val: string, code: string): string {
  return `${code} ${Number(val).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface BankAccountsPageClientProps {
  accounts: BankAccount[];
  currencies: SerializedCurrency[];
  companies: Company[];
}

export function BankAccountsPageClient({
  accounts,
  currencies,
  companies,
}: BankAccountsPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      [a.bankName, a.accountNumber, a.accountName, a.company.name, a.currency.code]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [accounts, search]);

  const handleToggleActive = async (a: BankAccount) => {
    setTogglingId(a.id);
    try {
      const res = await fetch(`/api/bank-accounts/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !a.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal mengubah status");
      toast.success(a.isActive ? "Rekening dinonaktifkan" : "Rekening diaktifkan");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <PageHeader
        title="Rekening Bank"
        description="Daftar rekening bank per PT"
        icon={<IconBuildingBank className="size-5" />}
        action={<BankAccountSheet currencies={currencies} companies={companies} />}
      />

      {accounts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada rekening bank</p>
          <p className="text-sm mt-1">Tambahkan rekening pertama untuk mulai mencatat saldo.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative max-w-xs">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Cari bank, rekening, PT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PT</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>No. Rekening</TableHead>
                  <TableHead>Nama Pemilik</TableHead>
                  <TableHead>Mata Uang</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Tidak ada hasil untuk &ldquo;{search}&rdquo;
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a) => {
                    const accountData: BankAccountData = {
                      id: a.id,
                      companyId: a.companyId,
                      bankName: a.bankName,
                      accountNumber: a.accountNumber ?? null,
                      accountName: a.accountName,
                      currencyId: a.currencyId,
                      note: a.note,
                    };
                    return (
                      <TableRow key={a.id} className={!a.isActive ? "opacity-50" : ""}>
                        <TableCell>{a.company.name}</TableCell>
                        <TableCell className="font-medium">{a.bankName}</TableCell>
                        <TableCell className="font-mono text-sm">{a.accountNumber}</TableCell>
                        <TableCell>{a.accountName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{a.currency.code}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtBalance(a.balance, a.currency.code)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.isActive ? "default" : "secondary"}>
                            {a.isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/bank-accounts/${a.id}/mutasi`}>Mutasi</Link>
                            </Button>
                            {a.isActive && (
                              <>
                                <BankMutationSheet
                                  bankAccountId={a.id}
                                  bankName={a.bankName}
                                  accountNumber={a.accountNumber ?? ""}
                                  currencyCode={a.currency.code}
                                  trigger={
                                    <Button variant="outline" size="sm">+ Dana</Button>
                                  }
                                />
                                <BankAccountSheet
                                  currencies={currencies}
                                  companies={companies}
                                  account={accountData}
                                  trigger={
                                    <Button variant="ghost" size="sm">Edit</Button>
                                  }
                                />
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title={a.isActive ? "Nonaktifkan" : "Aktifkan"}
                              disabled={togglingId === a.id}
                              onClick={() => handleToggleActive(a)}
                            >
                              <IconPower className={`size-4 ${a.isActive ? "text-emerald-500" : "text-muted-foreground"}`} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
