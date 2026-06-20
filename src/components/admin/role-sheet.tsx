"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import { PremiumField, FormSection } from "./premium-field";
import { ShieldCheck, FileText, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  companyId: string | null;
  permissions: string[];
};

interface Props {
  role?: RoleRow;
  trigger?: React.ReactNode;
  currentCompanyId?: string;
}

const AVAILABLE_PERMISSIONS = [
  { id: "view_dashboard", label: "Lihat Dashboard", description: "Akses ke halaman dashboard utama" },
  { id: "manage_users", label: "Kelola Pengguna", description: "Tambah, edit, dan hapus pengguna" },
  { id: "manage_branches", label: "Kelola Cabang", description: "Manajemen data kantor cabang" },
  { id: "manage_roles", label: "Kelola Role", description: "Manajemen hak akses dan role" },
  { id: "manage_stock", label: "Kelola Stok", description: "Manajemen inventaris dan kas" },
  { id: "manage_kpi", label: "Kelola KPI", description: "Pengaturan dan penilaian KPI" },
  { id: "view_reports", label: "Lihat Laporan", description: "Akses ke laporan keuangan dan operasional" },
];

const emptyForm = { name: "", description: "", permissions: [] as string[] };

export function RoleSheet({ role, trigger, currentCompanyId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const isEdit = !!role;

  useEffect(() => {
    if (open && role) {
      setForm({
        name: role.name,
        description: role.description ?? "",
        permissions: role.permissions,
      });
    } else if (open && !role) {
      setForm(emptyForm);
    } else if (!open) {
      setForm(emptyForm);
    }
  }, [open, role]);

  const togglePermission = (id: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(id)
        ? f.permissions.filter((p) => p !== id)
        : [...f.permissions, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama role wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const url = isEdit ? `/api/roles/${role.id}` : "/api/roles";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          companyId: currentCompanyId || null,
          permissions: form.permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan role");
        return;
      }
      toast.success(isEdit ? "Role diperbarui" : "Role ditambahkan");
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
      title={isEdit ? "Edit Role" : "Tambah Role"}
      description={
        isEdit
          ? "Perbarui hak akses dan deskripsi untuk role ini."
          : "Buat role baru dengan hak akses spesifik untuk perusahaan ini."
      }
      icon={<ShieldCheck className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={
        trigger ?? (
          <button style={{ background: "linear-gradient(to right, #dc2626, #f43f5e)", boxShadow: "0 4px 14px 0 rgba(220,38,38,0.35)" }} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-bold uppercase tracking-widest text-white transition-all duration-200">
            <ShieldCheck className="w-4 h-4" />
            Tambah Role
          </button>
        )
      }
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={loading}
          submitLabel={isEdit ? "Simpan Perubahan" : "Tambah Role"}
        />
      }
    >
      <FormSection title="Informasi Dasar" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
        <PremiumField
          label="Nama Role *"
          placeholder="Contoh: Manager Operasional"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          icon={<ShieldCheck className="w-4 h-4" />}
        />

        <PremiumField
          label="Deskripsi"
          placeholder="Penjelasan singkat mengenai role ini"
          value={form.description}
          onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
          icon={<FileText className="w-4 h-4" />}
        />
      </FormSection>

      <FormSection title="Hak Akses / Permissions" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
        <div className="grid gap-3">
          {AVAILABLE_PERMISSIONS.map((p) => {
            const isSelected = form.permissions.includes(p.id);
            return (
              <div
                key={p.id}
                onClick={() => togglePermission(p.id)}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer group",
                  isSelected 
                    ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20" 
                    : "bg-white/50 border-slate-200/60 hover:border-primary/20 hover:bg-slate-50"
                )}
              >
                <div className={cn(
                  "mt-0.5 transition-colors",
                  isSelected ? "text-primary" : "text-slate-300 group-hover:text-slate-400"
                )}>
                  {isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "text-[13px] font-bold transition-colors",
                    isSelected ? "text-slate-900" : "text-slate-600"
                  )}>
                    {p.label}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                    {p.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </FormSection>
    </AdminFormSidebar>
  );
}
