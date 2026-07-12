"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar } from "../admin-form-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconCoins, IconDiamond } from "@tabler/icons-react";

const TYPES = [
  { value: "CURRENCY", label: "Mata Uang", icon: <IconCoins className="size-4" /> },
  { value: "LOGAM_MULIA", label: "Logam Mulia", icon: <IconDiamond className="size-4" /> },
];

type CompanyStockItem = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  sortOrder: number;
};

interface Props {
  companyId: string;
  item?: CompanyStockItem;
  trigger?: React.ReactNode;
}

export function CompanyStockSheet({ companyId, item, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState(item?.type || "CURRENCY");
  const [form, setForm] = useState({
    name: "",
    code: "",
    sortOrder: "0",
  });

  const isEdit = !!item;

  const handleOpenChange = (next: boolean) => {
    if (next) {
      if (item) {
        setType(item.type);
        setForm({
          name: item.name,
          code: item.code || "",
          sortOrder: String(item.sortOrder || 0),
        });
      } else {
        setType("CURRENCY");
        setForm({ name: "", code: "", sortOrder: "0" });
      }
    }
    setOpen(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body = {
        companyId,
        name: form.name,
        code: form.code,
        type,
        sortOrder: parseInt(form.sortOrder) || 0,
      };
      const url = isEdit ? `/api/company-stock-items/${item.id}` : "/api/company-stock-items";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());

      toast.success(isEdit ? "Berhasil diperbarui" : "Berhasil ditambahkan");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("Gagal menyimpan: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={handleOpenChange}
      title={isEdit ? `Edit ${item.name}` : "Tambah Stok Baru"}
      trigger={trigger}
      onSubmit={handleSubmit}
      footer={
        <Button type="submit" disabled={loading} className="w-full bg-[#820302] hover:bg-[#820302]/90">
          {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Stok"}
        </Button>
      }
    >
      <div className="space-y-6 py-4">
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Tipe Stok</Label>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={isEdit}
                onClick={() => setType(t.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  type === t.value
                    ? "border-[#820302] bg-[#820302]/5 text-[#820302] font-bold"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                } ${isEdit && type !== t.value && "opacity-50 cursor-not-allowed"}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          <div className="grid gap-1.5">
            <Label>Nama Item *</Label>
            <Input
              placeholder={type === "CURRENCY" ? "Contoh: USD, SGD, JPY" : "Contoh: Emas 24K, LM Antam"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Kode Item</Label>
            <Input
              placeholder="Opsional (maks 10 karakter)"
              maxLength={10}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Urutan Tampilan</Label>
            <Input
              type="number"
              min="0"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </div>
        </div>
      </div>
    </AdminFormSidebar>
  );
}
