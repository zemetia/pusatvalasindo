"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PremiumField, PremiumNativeSelect, FormSection } from "./premium-field";
import { Landmark, CreditCard, User, FileText, Building2, CircleDollarSign } from "lucide-react";

type Branch = { id: string; name: string; companyId: string | null };
type Company = { id: string; name: string };
type Currency = { id: string; code: string; name: string };

export type BankAccountData = {
  id: string;
  branchId: string;
  bankName: string;
  accountNumber: string | null;
  accountName: string;
  currencyId: string;
  note: string | null;
};

interface Props {
  branches: Branch[];
  currencies: Currency[];
  companies: Company[];
  account?: BankAccountData;
  trigger?: React.ReactNode;
}

export function BankAccountSheet({ branches, currencies, companies, account, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!account;

  const initialBranchId = account?.branchId || "";
  const initialCompanyId = branches.find(b => b.id === initialBranchId)?.companyId || "";

  const empty = {
    companyId: initialCompanyId,
    branchId: initialBranchId,
    bankName: "",
    accountNumber: "",
    accountName: "",
    currencyId: "",
    note: "",
  };

  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (open) {
      const bId = account?.branchId || "";
      const cId = branches.find(b => b.id === bId)?.companyId || "";
      setForm({
        companyId: cId,
        branchId: bId,
        bankName: account?.bankName || "",
        accountNumber: account?.accountNumber || "",
        accountName: account?.accountName || "",
        currencyId: account?.currencyId || "",
        note: account?.note || "",
      });
    }
  }, [open, account, branches]);

  const set = (key: keyof typeof empty) => (val: string) =>
    setForm((f) => {
      const updated = { ...f, [key]: val };
      if (key === "companyId") {
        updated.branchId = "";
      }
      return updated;
    });

  const filteredBranches = branches.filter((b) => b.companyId === form.companyId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.branchId || !form.bankName || !form.accountName || !form.currencyId) {
      toast.error("Semua field wajib diisi kecuali nomor rekening dan catatan");
      return;
    }
    setLoading(true);
    try {
      const url = isEdit ? `/api/bank-accounts/${account.id}` : "/api/bank-accounts";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: form.branchId,
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          accountName: form.accountName,
          currencyId: form.currencyId,
          note: form.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan rekening");
        return;
      }
      toast.success(isEdit ? "Rekening berhasil diperbarui" : "Rekening berhasil ditambahkan");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={setOpen}
      title={isEdit ? "Edit Rekening Bank" : "Tambah Rekening Bank"}
      description={
        isEdit
          ? "Perbarui informasi detail rekening bank operasional."
          : "Tambahkan rekening bank baru untuk operasional cabang."
      }
      icon={<Landmark className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={
        trigger ?? (
          <button style={{ background: "linear-gradient(to right, #dc2626, #f43f5e)", boxShadow: "0 4px 14px 0 rgba(220,38,38,0.35)" }} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-bold uppercase tracking-widest text-white transition-all duration-200">
            <Landmark className="w-4 h-4" />
            {isEdit ? "Edit" : "Tambah Rekening"}
          </button>
        )
      }
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={loading}
          submitLabel={isEdit ? "Perbarui Rekening" : "Simpan Rekening"}
        />
      }
    >
      <FormSection title="Identifikasi" icon={<Landmark className="w-3.5 h-3.5" />}>
        <PremiumNativeSelect
          label="Perusahaan *"
          icon={<Building2 className="w-4 h-4" />}
          value={form.companyId}
          onChange={(e) => set("companyId")(e.target.value)}
          disabled={isEdit}
        >
          <option value="">Pilih perusahaan</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </PremiumNativeSelect>

        <PremiumNativeSelect
          label="Cabang *"
          icon={<Building2 className="w-4 h-4" />}
          value={form.branchId}
          onChange={(e) => set("branchId")(e.target.value)}
          disabled={isEdit || !form.companyId}
        >
          <option value="">Pilih cabang</option>
          {filteredBranches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </PremiumNativeSelect>

        <PremiumField
          label="Nama Bank *"
          placeholder="cth: BCA, Mandiri, BNI"
          value={form.bankName}
          onChange={(e) => set("bankName")(e.target.value)}
          icon={<Landmark className="w-4 h-4" />}
        />

        <PremiumField
          label="Nomor Rekening"
          placeholder="cth: 1234567890"
          value={form.accountNumber}
          onChange={(e) => set("accountNumber")(e.target.value)}
          icon={<CreditCard className="w-4 h-4" />}
        />
      </FormSection>

      <FormSection title="Detail" icon={<User className="w-3.5 h-3.5" />}>
        <PremiumField
          label="Nama Pemilik Rekening *"
          placeholder="Nama sesuai rekening"
          value={form.accountName}
          onChange={(e) => set("accountName")(e.target.value)}
          icon={<User className="w-4 h-4" />}
        />

        <PremiumNativeSelect
          label="Mata Uang *"
          icon={<CircleDollarSign className="w-4 h-4" />}
          value={form.currencyId}
          onChange={(e) => set("currencyId")(e.target.value)}
          disabled={isEdit}
        >
          <option value="" disabled>Pilih mata uang</option>
          {currencies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </PremiumNativeSelect>

        <PremiumField
          label="Catatan"
          placeholder="Opsional"
          value={form.note}
          onChange={(e) => set("note")(e.target.value)}
          icon={<FileText className="w-4 h-4" />}
        />
      </FormSection>
    </AdminFormSidebar>
  );
}
