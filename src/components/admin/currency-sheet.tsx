"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import { PremiumField } from "./premium-field";
import { Button } from "@/components/ui/button";
import { CircleDollarSign, Hash, Tag, Coins } from "lucide-react";

export type CurrencyRow = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  isActive: boolean;
};

interface Props {
  currency?: CurrencyRow;
  trigger?: React.ReactNode;
}

const empty = { code: "", name: "", symbol: "" };

export function CurrencySheet({ currency, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(empty);

  const isEdit = !!currency;

  useEffect(() => {
    if (open && currency) {
      setForm({ code: currency.code, name: currency.name, symbol: currency.symbol ?? "" });
    } else if (!open) {
      setForm(empty);
    }
  }, [open, currency]);

  const set = (key: keyof typeof empty) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Kode dan nama mata uang wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const url = isEdit ? `/api/currencies/${currency.id}` : "/api/currencies";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          name: form.name,
          symbol: form.symbol || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan");
        return;
      }
      toast.success(isEdit ? "Mata uang diperbarui" : "Mata uang ditambahkan");
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
      title={isEdit ? "Edit Mata Uang" : "Tambah Mata Uang"}
      description={
        isEdit
          ? "Sesuaikan detail mata uang yang tersedia."
          : "Tambahkan mata uang baru untuk transaksi valuta asing."
      }
      icon={<CircleDollarSign className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={
        trigger ?? (
          <Button className="gap-2">
            <Coins className="w-4 h-4" />
            Tambah Mata Uang
          </Button>
        )
      }
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={loading}
          submitLabel={isEdit ? "Simpan Perubahan" : "Tambah Mata Uang"}
        />
      }
    >
      <PremiumField
        label="Kode Mata Uang *"
        placeholder="Contoh: USD"
        value={form.code}
        onChange={(e) => set("code")(e.target.value.toUpperCase())}
        maxLength={10}
        disabled={isEdit}
        icon={<Hash className="w-4 h-4" />}
        error={isEdit ? "Kode tidak dapat diubah" : undefined}
      />

      <PremiumField
        label="Nama Mata Uang *"
        placeholder="Contoh: US Dollar"
        value={form.name}
        onChange={(e) => set("name")(e.target.value)}
        icon={<Coins className="w-4 h-4" />}
      />

      <PremiumField
        label="Simbol"
        placeholder="Contoh: $"
        value={form.symbol}
        onChange={(e) => set("symbol")(e.target.value)}
        maxLength={10}
        icon={<Tag className="w-4 h-4" />}
      />
    </AdminFormSidebar>
  );
}
