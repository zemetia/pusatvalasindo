"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar } from "./admin-form-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  bankAccountId: string;
  bankName: string;
  accountNumber: string;
  currencyCode: string;
  trigger?: React.ReactNode;
}

const empty = { type: "", amount: "", description: "" };

export function BankMutationSheet({
  bankAccountId,
  bankName,
  accountNumber,
  currencyCode,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(empty);

  const set = (key: keyof typeof empty) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type || !form.amount) {
      toast.error("Tipe dan nominal wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/bank-mutations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId,
          type: form.type,
          amount: parseFloat(form.amount),
          description: form.description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menambah mutasi");
        return;
      }
      toast.success("Mutasi rekening berhasil ditambahkan");
      setOpen(false);
      setForm(empty);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={setOpen}
      title="Tambah Mutasi Rekening"
      description={`${bankName} — ${accountNumber} (${currencyCode})`}
      onSubmit={handleSubmit}
      trigger={trigger ?? <Button variant="outline" size="sm">+ Mutasi</Button>}
      footer={
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Menyimpan..." : "Simpan Mutasi"}
        </Button>
      }
    >
      <div className="grid gap-1.5">
        <Label>Tipe *</Label>
        <Select value={form.type} onValueChange={set("type")}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CREDIT">Masuk (Credit)</SelectItem>
            <SelectItem value="DEBIT">Keluar (Debit)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Nominal ({currencyCode}) *</Label>
        <NumberInput
          placeholder="0"
          value={form.amount}
          onValueChange={(val) => set("amount")(val === undefined ? "" : String(val))}
        />
      </div>

      <div className="grid gap-1.5">
        <Label>Keterangan</Label>
        <Input
          placeholder="Opsional"
          value={form.description}
          onChange={(e) => set("description")(e.target.value)}
        />
      </div>
    </AdminFormSidebar>
  );
}
