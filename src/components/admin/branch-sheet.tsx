"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar, AdminFormFooter } from "./admin-form-sidebar";
import { PremiumField, PremiumNativeSelect } from "./premium-field";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Phone, Briefcase, Locate, Radius } from "lucide-react";

export type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  companyId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attendanceRadiusM?: number | null;
};

interface Props {
  branch?: BranchRow;
  companies: { id: string; name: string }[];
  trigger?: React.ReactNode;
  currentCompanyId?: string;
}

const emptyForm = {
  name: "",
  address: "",
  phone: "",
  companyId: "",
  latitude: "",
  longitude: "",
  attendanceRadiusM: "20",
};

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
        latitude: branch.latitude != null ? String(branch.latitude) : "",
        longitude: branch.longitude != null ? String(branch.longitude) : "",
        attendanceRadiusM: branch.attendanceRadiusM != null ? String(branch.attendanceRadiusM) : "20",
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
    const lat = form.latitude !== "" ? parseFloat(form.latitude) : null;
    const lng = form.longitude !== "" ? parseFloat(form.longitude) : null;
    if ((lat != null && isNaN(lat)) || (lng != null && isNaN(lng))) {
      toast.error("Koordinat latitude/longitude tidak valid");
      return;
    }
    const radius = form.attendanceRadiusM !== "" ? parseInt(form.attendanceRadiusM, 10) : null;

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
          latitude: lat,
          longitude: lng,
          attendanceRadiusM: radius,
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
          <Button className="gap-2">
            <Building2 className="w-4 h-4" />
            Tambah Cabang
          </Button>
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
          onValueChange={(val) => set("companyId")(val)}
          placeholder="Pilih Perusahaan"
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
        />
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

      <div className="pt-2 pb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Geofence Absensi
        </p>
        <div className="grid grid-cols-2 gap-3">
          <PremiumField
            label="Latitude"
            type="number"
            placeholder="-6.2088"
            value={form.latitude}
            onChange={(e) => set("latitude")(e.target.value)}
            icon={<Locate className="w-4 h-4" />}
          />
          <PremiumField
            label="Longitude"
            type="number"
            placeholder="106.8456"
            value={form.longitude}
            onChange={(e) => set("longitude")(e.target.value)}
            icon={<Locate className="w-4 h-4" />}
          />
        </div>
        <div className="mt-3">
          <PremiumField
            label="Radius Absensi (meter)"
            type="number"
            placeholder="20"
            value={form.attendanceRadiusM}
            onChange={(e) => set("attendanceRadiusM")(e.target.value)}
            icon={<Radius className="w-4 h-4" />}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
            Pegawai hanya bisa absen jika berada dalam radius ini dari titik koordinat cabang.
            Kosongkan latitude &amp; longitude untuk menonaktifkan validasi lokasi.
          </p>
        </div>
      </div>
    </AdminFormSidebar>
  );
}
