import Link from "next/link";
import prisma from "@/lib/prisma";
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
import { BankAccountSheet, BankAccountData } from "@/components/admin/bank-account-sheet";
import { BankMutationSheet } from "@/components/admin/bank-mutation-sheet";

function fmtBalance(val: unknown, code: string): string {
  return `${code} ${Number(val!.toString()).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export default async function BankAccountsPage() {
  const [accounts, branches, currencies, companies] = await Promise.all([
    prisma.bankAccount.findMany({
      include: { branch: true, currency: true },
      orderBy: [{ branch: { name: "asc" } }, { bankName: "asc" }],
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
    prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const serializedBranches = branches.map((b) => ({
    id: b.id,
    name: b.name,
    companyId: b.companyId,
  }));
  const serializedCurrencies = currencies.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rekening Bank</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daftar rekening bank per cabang
          </p>
        </div>
        <BankAccountSheet
          branches={serializedBranches}
          currencies={serializedCurrencies}
          companies={companies}
        />
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Belum ada rekening bank</p>
          <p className="text-sm mt-1">Tambahkan rekening pertama untuk mulai mencatat saldo.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cabang</TableHead>
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
              {accounts.map((a) => {
                const accountData: BankAccountData = {
                  id: a.id,
                  branchId: a.branchId,
                  bankName: a.bankName,
                  accountNumber: a.accountNumber ?? null,
                  accountName: a.accountName,
                  currencyId: a.currencyId,
                  note: a.note,
                };
                return (
                  <TableRow key={a.id} className={!a.isActive ? "opacity-50" : ""}>
                    <TableCell>{a.branch.name}</TableCell>
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
                          <Link href={`/dashboard/bank-accounts/${a.id}/mutasi`}>
                            Mutasi
                          </Link>
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
                              branches={serializedBranches}
                              currencies={serializedCurrencies}
                              companies={companies}
                              account={accountData}
                              trigger={
                                <Button variant="ghost" size="sm">Edit</Button>
                              }
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
