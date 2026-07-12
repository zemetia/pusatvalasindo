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

type Company = { id: string; name: string };
type Currency = { id: string; code: string; name: string };

export type BankAccountData = {
  id: string;
  companyId: string;
  bankName: string;
  accountNumber: string | null;
  accountName: string;
  currencyId: string;
  note: string | null;
};

interface Props {
  currencies: Currency[];
  companies: Company[];
  account?: BankAccountData;
  trigger?: React.ReactNode;
}

export function BankAccountSheet({ currencies, companies, account, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!account;

  const empty = {
    companyId: account?.companyId || "",
    bankName: "",
    accountNumber: "",
    accountName: "",
    currencyId: "",
    note: "",
  };

  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (open) {
      setForm({
        companyId: account?.companyId || "",
        bankName: account?.bankName || "",
        accountNumber: account?.accountNumber || "",
        accountName: account?.accountName || "",
        currencyId: account?.currencyId || "",
        note: account?.note || "",
      });
    }
  }, [open, account]);

  const set = (key: keyof typeof empty) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyId || !form.bankName || !form.accountName || !form.currencyId) {
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
          companyId: form.companyId,
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
          : "Tambahkan rekening bank baru untuk operasional PT."
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
