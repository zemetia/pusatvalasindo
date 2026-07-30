"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import { PremiumField, PremiumNativeSelect, FormSection } from "./premium-field";
import {
  UserSalaryComponents,
  type SalaryComponentItem,
} from "./user-salary-components";
import { NumericFormat } from "react-number-format";
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
  positionAllowance: unknown;
  bpjsKesehatan: unknown;
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
    positionAllowance: "",
    bpjsKesehatan: "",
    joinDate: "",
  });

  /**
   * Komponen gaji tambahan. Disimpan lewat endpoint terpisah karena gerbang
   * izinnya beda (payroll.components, bukan kelola pengguna) — lihat
   * src/app/api/users/[id]/salary-components/route.ts.
   */
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponentItem[]>([]);

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
        positionAllowance: user.positionAllowance ? String(user.positionAllowance) : "",
        bpjsKesehatan: user.bpjsKesehatan ? String(user.bpjsKesehatan) : "",
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
          positionAllowance: form.positionAllowance ? parseFloat(form.positionAllowance) : null,
          bpjsKesehatan: form.bpjsKesehatan ? parseFloat(form.bpjsKesehatan) : null,
          joinDate: form.joinDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menyimpan pengguna");
        return;
      }

      // Profil sudah tersimpan di titik ini; kegagalan komponen dilaporkan
      // sendiri supaya jelas bagian mana yang belum tersimpan. 403 diabaikan:
      // artinya editor komponen memang tidak ditampilkan untuk pemanggil ini.
      const compRes = await fetch(`/api/users/${user.id}/salary-components`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: salaryComponents }),
      });
      if (!compRes.ok && compRes.status !== 403) {
        const compData = await compRes.json().catch(() => ({}));
        toast.error(compData.message || "Profil tersimpan, tapi komponen gaji gagal disimpan");
        router.refresh();
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
            onValueChange={(val) => set("companyId")(val)}
            placeholder="Pilih perusahaan"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
          />

          <PremiumNativeSelect
            label="Cabang Penugasan"
            icon={<Building2 className="w-4 h-4" />}
            value={form.branchId}
            onValueChange={(val) => set("branchId")(val)}
            disabled={!form.companyId}
            options={[
              { value: "none", label: "— Tanpa cabang —" },
              ...filteredBranches.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </div>

        <PremiumNativeSelect
          label="Jabatan / Role"
          icon={<ShieldCheck className="w-4 h-4" />}
          value={form.customRoleId}
          onValueChange={(val) => set("customRoleId")(val)}
          disabled={!form.companyId}
          options={[
            { value: "none", label: "— Tanpa jabatan —" },
            ...filteredRoles.map((r) => ({ value: r.id, label: r.name })),
          ]}
        />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <FormSection
        title="Komponen Gaji Tambahan"
        icon={<Banknote className="w-3.5 h-3.5" />}
      >
        {open && (
          <UserSalaryComponents
            userId={user.id}
            companyId={form.companyId}
            value={salaryComponents}
            onChange={setSalaryComponents}
          />
        )}
      </FormSection>
    </AdminFormSidebar>
  );
}
