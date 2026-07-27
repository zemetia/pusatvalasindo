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
import { PageHeader } from "@/components/admin/page-header";
import { IconBuildingBank, IconSearch, IconTrash, IconBuilding } from "@tabler/icons-react";

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
  // Non-privileged roles are locked to their own PT, so the PT filter bar is hidden for them.
  canSelectCompany?: boolean;
}

export function BankAccountsPageClient({
  accounts,
  currencies,
  companies,
  canSelectCompany = true,
}: BankAccountsPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts
      .filter((a) => !activeCompanyId || a.companyId === activeCompanyId)
      .filter((a) =>
        !q ||
        [a.bankName, a.accountNumber, a.accountName, a.company.name, a.currency.code]
          .some((v) => v?.toLowerCase().includes(q))
      );
  }, [accounts, search, activeCompanyId]);

  const handleDelete = async (a: BankAccount) => {
    if (!confirm(`Hapus rekening ${a.bankName} - ${a.accountName}? Rekening yang sudah dihapus tidak akan tampil lagi.`)) {
      return;
    }
    setDeletingId(a.id);
    try {
      const res = await fetch(`/api/bank-accounts/${a.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menghapus rekening");
      toast.success("Rekening berhasil dihapus");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus rekening");
    } finally {
      setDeletingId(null);
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

      {canSelectCompany && companies.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconBuilding className="size-4" />
            <span>Perusahaan (PT)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCompanyId("")}
              className={`px-6 py-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-start gap-1 group ${
                activeCompanyId === ""
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/50 bg-card hover:border-border hover:bg-muted/50"
              }`}
            >
              <span
                className={`text-xs uppercase tracking-widest font-bold ${
                  activeCompanyId === "" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Semua
              </span>
              <span
                className={`text-lg font-bold tracking-tight ${
                  activeCompanyId === "" ? "text-foreground" : "text-foreground/70"
                }`}
              >
                Semua PT
              </span>
            </button>
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => setActiveCompanyId(company.id)}
                className={`px-6 py-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-start gap-1 group ${
                  activeCompanyId === company.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/50 bg-card hover:border-border hover:bg-muted/50"
                }`}
              >
                <span
                  className={`text-xs uppercase tracking-widest font-bold ${
                    activeCompanyId === company.id ? "text-primary" : "text-muted-foreground"
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
          </div>
        </div>
      )}

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
                  <TableHead className="text-right">Aksi</TableHead>
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
                      <TableRow key={a.id}>
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
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/bank-accounts/${a.id}/mutasi`}>Mutasi</Link>
                            </Button>
                            <BankAccountSheet
                              currencies={currencies}
                              companies={companies}
                              account={accountData}
                              trigger={
                                <Button variant="ghost" size="sm">Edit</Button>
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Hapus"
                              disabled={deletingId === a.id}
                              onClick={() => handleDelete(a)}
                            >
                              <IconTrash className="size-4 text-destructive" />
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
