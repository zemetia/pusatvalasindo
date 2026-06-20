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
import {
  UserCog,
  User,
  Mail,
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

export type UserRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  roleId: string | null;
  roleName: string | null;
  branchId: string | null;
  baseSalary: unknown;
  mealAllowance: unknown;
  transportAllowance: unknown;
  joinDate: string | null;
  isActive: boolean;
  createdAt: string;
  branch: { id: string; name: string } | null;
};

interface Props {
  user: UserRow;
  branches: Branch[];
  companies: Company[];
  roles: Role[];
  trigger?: React.ReactNode;
}

function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  return val.slice(0, 10);
}

export function UserSheet({ user, branches, companies, roles, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const initialCompanyId = branches.find(b => b.id === user.branchId)?.companyId || "";

  const [form, setForm] = useState({
    name: "",
    phone: "",
    customRoleId: "",
    companyId: initialCompanyId,
    branchId: "",
    baseSalary: "",
    mealAllowance: "",
    transportAllowance: "",
    joinDate: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: user.name,
        phone: user.phone ?? "",
        customRoleId: user.roleId ?? "",
        companyId: initialCompanyId,
        branchId: user.branchId ?? "",
        baseSalary: user.baseSalary ? String(user.baseSalary) : "",
        mealAllowance: user.mealAllowance ? String(user.mealAllowance) : "",
        transportAllowance: user.transportAllowance ? String(user.transportAllowance) : "",
        joinDate: toDateInput(user.joinDate),
      });
    }
  }, [open, user]);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => {
      const updated = { ...f, [key]: val };
      if (key === "companyId") {
        updated.branchId = "";
      }
      return updated;
    });

  const filteredBranches = branches.filter((b) => b.companyId === form.companyId);
  const filteredRoles = roles.filter(r => r.companyId === form.companyId || r.companyId === null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || undefined,
          customRoleId: form.customRoleId || null,
          branchId: form.branchId || null,
          baseSalary: form.baseSalary ? parseFloat(form.baseSalary) : null,
          mealAllowance: form.mealAllowance ? parseFloat(form.mealAllowance) : null,
          transportAllowance: form.transportAllowance ? parseFloat(form.transportAllowance) : null,
          joinDate: form.joinDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan pengguna");
        return;
      }
      toast.success("Pengguna diperbarui");
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
      title="Edit Pengguna"
      description="Perbarui informasi profil dan penugasan karyawan."
      icon={<UserCog className="w-5 h-5" />}
      onSubmit={handleSubmit}
      trigger={trigger}
      footer={
        <AdminFormFooter
          onCancel={() => setOpen(false)}
          loading={loading}
          submitLabel="Simpan Perubahan"
        />
      }
    >
      <FormSection title="Identitas" icon={<User className="w-3.5 h-3.5" />}>
        <PremiumField
          label="Email"
          value={user.email}
          disabled
          icon={<Mail className="w-4 h-4" />}
        />
        <PremiumField
          label="Nama Lengkap *"
          placeholder="Nama pengguna"
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          icon={<User className="w-4 h-4" />}
        />
      </FormSection>

      <FormSection title="Penugasan" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
        <div className="space-y-4">
          <PremiumNativeSelect
            label="Perusahaan"
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
            label="Cabang Penugasan"
            icon={<Building2 className="w-4 h-4" />}
            value={form.branchId}
            onChange={(e) => set("branchId")(e.target.value)}
            disabled={!form.companyId}
          >
            <option value="none">— Tanpa cabang —</option>
            {filteredBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </PremiumNativeSelect>
        </div>

        <PremiumNativeSelect
          label="Jabatan / Role"
          icon={<ShieldCheck className="w-4 h-4" />}
          value={form.customRoleId}
          onChange={(e) => set("customRoleId")(e.target.value)}
          disabled={!form.companyId}
        >
          <option value="none">— Tanpa jabatan —</option>
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
        <PremiumField
          label="Gaji Pokok (IDR)"
          type="number"
          min="0"
          step="1000"
          placeholder="0"
          value={form.baseSalary}
          onChange={(e) => set("baseSalary")(e.target.value)}
          icon={<Banknote className="w-4 h-4" />}
        />
        <div className="grid grid-cols-2 gap-4">
          <PremiumField
            label="Uang Makan (IDR)"
            type="number"
            min="0"
            step="1000"
            placeholder="0"
            value={form.mealAllowance}
            onChange={(e) => set("mealAllowance")(e.target.value)}
            icon={<Banknote className="w-4 h-4" />}
          />
          <PremiumField
            label="Uang Transport (IDR)"
            type="number"
            min="0"
            step="1000"
            placeholder="0"
            value={form.transportAllowance}
            onChange={(e) => set("transportAllowance")(e.target.value)}
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
