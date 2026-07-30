"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import { PremiumField } from "./premium-field";
import { Button } from "@/components/ui/button";
import { Briefcase, Hash } from "lucide-react";

export type CompanyRow = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

interface Props {
  company?: CompanyRow;
  trigger?: React.ReactNode;
}

const emptyForm = { name: "", code: "" };

export function CompanySheet({ company, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const isEdit = !!company;

  // Form diisi saat panel dibuka, bukan lewat useEffect: ini respons terhadap
  // sebuah kejadian, bukan sinkronisasi ke sistem luar.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setForm(next && company ? { name: company.name, code: company.code } : emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama PT wajib diisi");
      return;
    }
    if (!form.code.trim()) {
      toast.error("Kode PT wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/companies/${company.id}` : "/api/companies";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), code: form.code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan PT");
        return;
      }
      toast.success(isEdit ? "PT diperbarui" : "PT ditambahkan");
      handleOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={handleOpenChange}
      title={isEdit ? "Edit PT" : "Tambah PT"}
      description={
        isEdit
          ? "Perbarui nama dan kode badan usaha ini."
          : "Daftarkan badan usaha (PT) baru sebagai naungan cabang."
      }
      icon={<Briefcase className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={
        trigger ?? (
          <Button className="gap-2">
            <Briefcase className="w-4 h-4" />
            Tambah PT
          </Button>
        )
      }
      footer={
        <AdminFormFooter
          onCancel={() => handleOpenChange(false)}
          loading={loading}
          submitLabel={isEdit ? "Simpan Perubahan" : "Tambah PT"}
        />
      }
    >
      <PremiumField
        label="Nama PT *"
        placeholder="PT Pusat Valas Indo"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        icon={<Briefcase className="w-4 h-4" />}
      />

      <div>
        <PremiumField
          label="Kode PT *"
          placeholder="PVI"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          icon={<Hash className="w-4 h-4" />}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
          Singkatan pendek yang dipakai di seluruh laporan. Harus unik, otomatis huruf besar.
        </p>
      </div>
    </AdminFormSidebar>
  );
}
