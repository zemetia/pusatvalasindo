"use client";

import { useState } from "react";
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
import { NumericFormat } from "react-number-format";
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Phone,
  Banknote,
  Calendar,
  Building2,
  ShieldCheck,
} from "lucide-react";

// Roles are now dynamic


type Branch = { id: string; name: string; companyId: string | null };
type Company = { id: string; name: string };
type Role = { id: string; name: string; companyId: string | null };

interface Props {
  branches: Branch[];
  companies: Company[];
  roles: Role[];
}

const emptyForm = {
  name: "",
  email: "",
  password: "",
  confirm: "",
  customRoleId: "",
  companyId: "",
  branchId: "",
  phone: "",
  baseSalary: "",
  mealAllowance: "",
  transportAllowance: "",
  positionAllowance: "",
  bpjsKesehatan: "",
  joinDate: "",
};

export function CreateUserSheet({ branches, companies, roles }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const set = (key: keyof typeof emptyForm) => (val: string) =>
    setForm((f) => {
      const updated = { ...f, [key]: val };
      // Reset branch if company changes
      if (key === "companyId") {
        updated.branchId = "";
      }
      return updated;
    });

  const filteredBranches = branches.filter(b => b.companyId === form.companyId);
  const filteredRoles = roles.filter(r => r.companyId === form.companyId || r.companyId === null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.customRoleId || !form.branchId) {
      toast.error("Nama, email, jabatan, dan cabang wajib diisi");
      return;
    }
    if (form.password) {
      if (form.password.length < 8) {
        toast.error("Kata sandi minimal 8 karakter");
        return;
      }
      if (form.password !== form.confirm) {
        toast.error("Konfirmasi kata sandi tidak cocok");
        return;
      }
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password || undefined,
          customRoleId: form.customRoleId,
          branchId: form.branchId,
          phone: form.phone || undefined,
          baseSalary: form.baseSalary ? parseFloat(form.baseSalary) : undefined,
          mealAllowance: form.mealAllowance ? parseFloat(form.mealAllowance) : undefined,
          transportAllowance: form.transportAllowance ? parseFloat(form.transportAllowance) : undefined,
          positionAllowance: form.positionAllowance ? parseFloat(form.positionAllowance) : undefined,
          bpjsKesehatan: form.bpjsKesehatan ? parseFloat(form.bpjsKesehatan) : undefined,
          joinDate: form.joinDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || data.message || "Gagal membuat pengguna");
        return;
      }
      toast.success("Pengguna berhasil dibuat");
      setOpen(false);
      setForm(emptyForm);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={setOpen}
      title="Buat Pengguna Baru"
      description="Daftarkan karyawan baru ke sistem dengan informasi lengkap."
      icon={<UserPlus className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={
        <button style={{ background: "linear-gradient(to right, #dc2626, #f43f5e)", boxShadow: "0 4px 14px 0 rgba(220,38,38,0.35)" }} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-bold uppercase tracking-widest text-white transition-all duration-200">
          <UserPlus className="w-4 h-4" />
          Buat Pengguna
        </button>
      }
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={loading}
          submitLabel="Buat Pengguna"
          loadingLabel="Membuat..."
        />
      }
    >
      <FormSection title="Identitas" icon={<User className="w-3.5 h-3.5" />}>
        <PremiumField
          label="Nama Lengkap *"
          placeholder="Nama lengkap karyawan"
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          icon={<User className="w-4 h-4" />}
        />
        <PremiumField
          label="Email *"
          type="email"
          placeholder="email@contoh.com"
          value={form.email}
          onChange={(e) => set("email")(e.target.value)}
          icon={<Mail className="w-4 h-4" />}
        />
      </FormSection>

      <FormSection title="Keamanan" icon={<Lock className="w-3.5 h-3.5" />}>
        <PremiumField
          label="Kata Sandi"
          type="password"
          placeholder="Kosongkan untuk generate otomatis"
          value={form.password}
          onChange={(e) => set("password")(e.target.value)}
          icon={<Lock className="w-4 h-4" />}
        />
        <PremiumField
          label="Konfirmasi Kata Sandi"
          type="password"
          placeholder="Ulangi kata sandi"
          value={form.confirm}
          onChange={(e) => set("confirm")(e.target.value)}
          icon={<Lock className="w-4 h-4" />}
        />
      </FormSection>

      <FormSection title="Penugasan" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
        <PremiumNativeSelect
          label="Perusahaan *"
          icon={<Building2 className="w-4 h-4" />}
          value={form.companyId}
          onChange={(e) => set("companyId")(e.target.value)}
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
          disabled={!form.companyId}
        >
          <option value="">Pilih cabang</option>
          {filteredBranches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </PremiumNativeSelect>

        <PremiumNativeSelect
          label="Jabatan / Role *"
          icon={<ShieldCheck className="w-4 h-4" />}
          value={form.customRoleId}
          onChange={(e) => set("customRoleId")(e.target.value)}
          disabled={!form.companyId}
        >
          <option value="" disabled>Pilih jabatan</option>
          {filteredRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </PremiumNativeSelect>
      </FormSection>

      <FormSection title="Detail Karyawan" icon={<Banknote className="w-3.5 h-3.5" />}>
        <PremiumField
          label="No. Telepon"
          type="tel"
          placeholder="628xxxxxxxxxx"
          value={form.phone}
          onChange={(e) => set("phone")(e.target.value)}
          icon={<Phone className="w-4 h-4" />}
        />
        <NumericFormat
          customInput={PremiumField}
          label="Gaji Pokok (IDR)"
          thousandSeparator="."
          decimalSeparator=","
          allowNegative={false}
          placeholder="0"
          value={form.baseSalary}
          onValueChange={(v) => set("baseSalary")(v.value)}
          icon={<Banknote className="w-4 h-4" />}
        />
        <div className="grid grid-cols-2 gap-4">
          <NumericFormat
            customInput={PremiumField}
            label="Uang Makan (IDR)"
            thousandSeparator="."
            decimalSeparator=","
            allowNegative={false}
            placeholder="0"
            value={form.mealAllowance}
            onValueChange={(v) => set("mealAllowance")(v.value)}
            icon={<Banknote className="w-4 h-4" />}
          />
          <NumericFormat
            customInput={PremiumField}
            label="Uang Transport (IDR)"
            thousandSeparator="."
            decimalSeparator=","
            allowNegative={false}
            placeholder="0"
            value={form.transportAllowance}
            onValueChange={(v) => set("transportAllowance")(v.value)}
            icon={<Banknote className="w-4 h-4" />}
          />
          <NumericFormat
            customInput={PremiumField}
            label="Uang Jabatan (IDR)"
            thousandSeparator="."
            decimalSeparator=","
            allowNegative={false}
            placeholder="0"
            value={form.positionAllowance}
            onValueChange={(v) => set("positionAllowance")(v.value)}
            icon={<Banknote className="w-4 h-4" />}
          />
          <NumericFormat
            customInput={PremiumField}
            label="BPJS Kesehatan (IDR)"
            thousandSeparator="."
            decimalSeparator=","
            allowNegative={false}
            placeholder="0"
            value={form.bpjsKesehatan}
            onValueChange={(v) => set("bpjsKesehatan")(v.value)}
            icon={<Banknote className="w-4 h-4" />}
          />
        </div>
        <PremiumField
          label="Tanggal Bergabung"
          type="date"
          value={form.joinDate}
          onChange={(e) => set("joinDate")(e.target.value)}
          icon={<Calendar className="w-4 h-4" />}
        />
      </FormSection>
    </AdminFormSidebar>
  );
}
