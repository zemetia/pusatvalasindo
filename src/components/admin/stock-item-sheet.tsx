"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import { PremiumField, PremiumNativeSelect } from "./premium-field";
import { Button } from "@/components/ui/button";
import { Package, Tag, Hash, ListOrdered, Building2, Layers } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  CURRENCY: "Mata Uang",
  GOLD: "Emas",
  CASH: "Kas",
};

type Branch = { id: string; name: string; companyId: string | null };
type Company = { id: string; name: string };

export type StockItemRow = {
  id: string;
  branchId: string;
  name: string;
  code: string | null;
  type: string;
  sortOrder: number;
  isActive: boolean;
};

interface Props {
  branches: Branch[];
  companies: Company[];
  item?: StockItemRow;
  defaultBranchId?: string;
  trigger?: React.ReactNode;
}

const emptyForm = { 
  companyId: "",
  branchId: "", 
  name: "", 
  code: "", 
  type: "CURRENCY", 
  sortOrder: "0" 
};

export function StockItemSheet({ branches, companies, item, defaultBranchId, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!item;
  const initialBranchId = item?.branchId || defaultBranchId || "";
  const initialCompanyId = branches.find(b => b.id === initialBranchId)?.companyId || "";

  const [form, setForm] = useState({ 
    ...emptyForm, 
    branchId: initialBranchId,
    companyId: initialCompanyId,
  });

  useEffect(() => {
    if (open) {
      const bId = item?.branchId || defaultBranchId || "";
      const cId = branches.find(b => b.id === bId)?.companyId || "";
      setForm({
        companyId: cId,
        branchId: bId,
        name: item?.name || "",
        code: item?.code || "",
        type: item?.type || "CURRENCY",
        sortOrder: String(item?.sortOrder || "0"),
      });
    }
  }, [open, item, defaultBranchId, branches]);

  const set = (key: keyof typeof form) => (val: string) =>
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
    if (!form.branchId || !form.name.trim()) {
      toast.error("Cabang dan nama item wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const url = isEdit ? `/api/stock-items/${item.id}` : "/api/stock-items";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: form.branchId,
          name: form.name,
          code: form.code || undefined,
          type: form.type,
          sortOrder: parseInt(form.sortOrder) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan item");
        return;
      }
      toast.success(isEdit ? "Item diperbarui" : "Item ditambahkan");
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
      title={isEdit ? "Edit Item Stok" : "Tambah Item Stok"}
      description={
        isEdit
          ? "Perbarui detail item stok yang ada."
          : "Daftarkan aset baru ke dalam sistem stok cabang."
      }
      icon={<Package className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={
        trigger ?? (
          <Button className="gap-2">
            <Package className="w-4 h-4" />
            Tambah Item
          </Button>
        )
      }
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={loading}
          submitLabel={isEdit ? "Simpan Perubahan" : "Tambah Item"}
        />
      }
    >
      <PremiumNativeSelect
        label="Perusahaan *"
        icon={<Building2 className="w-4 h-4" />}
        value={form.companyId}
        onValueChange={(val) => set("companyId")(val)}
        disabled={isEdit || !!defaultBranchId}
        placeholder="Pilih perusahaan"
        options={companies.map((c) => ({ value: c.id, label: c.name }))}
      />

      <PremiumNativeSelect
        label="Cabang *"
        icon={<Building2 className="w-4 h-4" />}
        value={form.branchId}
        onValueChange={(val) => set("branchId")(val)}
        disabled={isEdit || !!defaultBranchId || !form.companyId}
        placeholder="Pilih cabang"
        options={filteredBranches.map((b) => ({ value: b.id, label: b.name }))}
      />

      <PremiumField
        label="Nama Item *"
        placeholder="Contoh: USD, Emas 24K"
        value={form.name}
        onChange={(e) => set("name")(e.target.value)}
        icon={<Tag className="w-4 h-4" />}
      />

      <PremiumField
        label="Kode"
        placeholder="Opsional, maks 10 karakter"
        maxLength={10}
        value={form.code}
        onChange={(e) => set("code")(e.target.value)}
        icon={<Hash className="w-4 h-4" />}
      />

      <PremiumNativeSelect
        label="Tipe *"
        icon={<Layers className="w-4 h-4" />}
        value={form.type}
        onValueChange={(val) => set("type")(val)}
        placeholder="Pilih tipe"
        options={Object.entries(TYPE_LABELS).map(([val, label]) => ({ value: val, label }))}
      />

      <PremiumField
        label="Urutan"
        type="number"
        min="0"
        placeholder="0"
        value={form.sortOrder}
        onChange={(e) => set("sortOrder")(e.target.value)}
        icon={<ListOrdered className="w-4 h-4" />}
      />
    </AdminFormSidebar>
  );
}
