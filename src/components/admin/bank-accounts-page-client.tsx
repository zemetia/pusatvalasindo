"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
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
import { BankAccountSheet } from "@/components/admin/bank-account-sheet";
import type { BankAccountData } from "@/components/admin/bank-account-sheet";
import {
  PageShell,
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/admin/page-shell";
import { SearchInput } from "@/components/admin/search-input";
import { SegmentedFilter } from "@/components/admin/segmented-filter";
import { IconBuildingBank, IconTrash, IconPencil, IconCash } from "@tabler/icons-react";

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
    <PageShell>
      <PageHeader
        title="Rekening Bank"
        description="Daftar rekening bank per PT"
        icon={<IconBuildingBank className="size-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/stockist/bank">
                <IconCash className="size-4" />
                Isi Saldo Bank Hari Ini
              </Link>
            </Button>
            <BankAccountSheet currencies={currencies} companies={companies} />
          </div>
        }
      />

      {accounts.length === 0 ? (
        <SectionCard padded={false}>
          <EmptyState
            icon={<IconBuildingBank className="size-5" />}
            title="Belum ada rekening bank"
            description="Tambahkan rekening pertama untuk mulai mencatat saldo."
            action={<BankAccountSheet currencies={currencies} companies={companies} />}
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
                placeholder="Cari bank, rekening, PT..."
              />
              {canSelectCompany && companies.length > 0 && (
                <SegmentedFilter
                  aria-label="Filter perusahaan"
                  value={activeCompanyId}
                  onChange={setActiveCompanyId}
                  options={[
                    { value: "", label: "Semua PT" },
                    ...companies.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}
              <span className="text-muted-foreground ml-auto text-xs">
                {filtered.length} dari {accounts.length} rekening
              </span>
            </>
          }
        >
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
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      title="Tidak ada hasil"
                      description="Ubah kata kunci pencarian atau filter PT."
                    />
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
                      <TableCell className="text-muted-foreground">{a.company.name}</TableCell>
                      <TableCell className="font-medium">{a.bankName}</TableCell>
                      <TableCell className="tabular font-mono">{a.accountNumber}</TableCell>
                      <TableCell>{a.accountName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {a.currency.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {fmtBalance(a.balance, a.currency.code)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <BankAccountSheet
                            currencies={currencies}
                            companies={companies}
                            account={accountData}
                            trigger={
                              <Button variant="ghost" size="icon" title="Edit rekening">
                                <IconPencil className="size-4" />
                              </Button>
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Hapus"
                            disabled={deletingId === a.id}
                            onClick={() => handleDelete(a)}
                          >
                            <IconTrash className="text-destructive size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </PageShell>
  );
}
