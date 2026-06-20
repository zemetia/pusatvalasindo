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
import { PremiumField, PremiumNativeSelect } from "./premium-field";
import { Building2, MapPin, Phone, Briefcase } from "lucide-react";

export type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  companyId?: string | null;
};

interface Props {
  branch?: BranchRow;
  companies: { id: string; name: string }[];
  trigger?: React.ReactNode;
  currentCompanyId?: string;
}

const emptyForm = { name: "", address: "", phone: "", companyId: "" };

export function BranchSheet({ branch, companies, trigger, currentCompanyId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const isEdit = !!branch;

  useEffect(() => {
    if (open && branch) {
      setForm({
        name: branch.name,
        address: branch.address ?? "",
        phone: branch.phone ?? "",
        companyId: branch.companyId ?? "",
      });
    } else if (open && !branch) {
      setForm({ ...emptyForm, companyId: currentCompanyId ?? "" });
    } else if (!open) {
      setForm(emptyForm);
    }
  }, [open, branch, currentCompanyId]);

  const set = (key: keyof typeof emptyForm) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama cabang wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const url = isEdit ? `/api/branches/${branch.id}` : "/api/branches";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address || undefined,
          phone: form.phone || undefined,
          companyId: form.companyId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan cabang");
        return;
      }
      toast.success(isEdit ? "Cabang diperbarui" : "Cabang ditambahkan");
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
      title={isEdit ? "Edit Cabang" : "Tambah Cabang"}
      description={
        isEdit
          ? "Perbarui informasi detail untuk kantor cabang ini."
          : "Daftarkan kantor cabang baru ke dalam sistem."
      }
      icon={<Building2 className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={
        trigger ?? (
          <button style={{ background: "linear-gradient(to right, #dc2626, #f43f5e)", boxShadow: "0 4px 14px 0 rgba(220,38,38,0.35)" }} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-bold uppercase tracking-widest text-white transition-all duration-200">
            <Building2 className="w-4 h-4" />
            Tambah Cabang
          </button>
        )
      }
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={loading}
          submitLabel={isEdit ? "Simpan Perubahan" : "Tambah Cabang"}
        />
      }
    >
      <PremiumField
        label="Nama Cabang *"
        placeholder="Nama cabang"
        value={form.name}
        onChange={(e) => set("name")(e.target.value)}
        icon={<Building2 className="w-4 h-4" />}
      />

      {isEdit && (
        <PremiumNativeSelect
          label="Perusahaan (PT) *"
          icon={<Briefcase className="w-4 h-4" />}
          value={form.companyId}
          onChange={(e) => set("companyId")(e.target.value)}
        >
          <option value="" disabled>Pilih Perusahaan</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </PremiumNativeSelect>
      )}

      <PremiumField
        label="Alamat"
        placeholder="Alamat lengkap cabang"
        value={form.address}
        onChange={(e) => set("address")(e.target.value)}
        icon={<MapPin className="w-4 h-4" />}
      />

      <PremiumField
        label="Telepon"
        type="tel"
        placeholder="Opsional"
        value={form.phone}
        onChange={(e) => set("phone")(e.target.value)}
        icon={<Phone className="w-4 h-4" />}
      />
    </AdminFormSidebar>
  );
}
