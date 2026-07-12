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

const MUTATION_TYPE_LABELS: Record<string, string> = {
  OPENING: "Stok Awal",
  BUY: "Beli dari Nasabah",
  SELL: "Jual ke Nasabah",
  TRANSFER_IN: "Terima Transfer",
  TRANSFER_OUT: "Kirim Transfer",
  ADJUSTMENT: "Koreksi Manual",
};

type Branch = { id: string; name: string };
type Currency = { id: string; code: string; name: string };

interface Props {
  branches: Branch[];
  currencies: Currency[];
  trigger?: React.ReactNode;
}

const empty = { branchId: "", currencyId: "", type: "", quantity: "", rate: "", note: "" };

export function StockMutationSheet({ branches, currencies, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(empty);

  const set = (key: keyof typeof empty) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.branchId || !form.currencyId || !form.type || !form.quantity) {
      toast.error("Cabang, mata uang, tipe, dan jumlah wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stock-mutations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: form.branchId,
          currencyId: form.currencyId,
          type: form.type,
          quantity: parseFloat(form.quantity),
          rate: form.rate ? parseFloat(form.rate) : undefined,
          note: form.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menambah mutasi");
        return;
      }
      toast.success("Mutasi stok berhasil ditambahkan");
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
      title="Tambah Mutasi Stok"
      onSubmit={handleSubmit}
      trigger={trigger ?? <Button>+ Tambah Mutasi</Button>}
      footer={
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Menyimpan..." : "Simpan Mutasi"}
        </Button>
      }
    >
      <div className="grid gap-1.5">
        <Label>Cabang *</Label>
        <Select value={form.branchId} onValueChange={set("branchId")}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih cabang" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Mata Uang *</Label>
        <Select value={form.currencyId} onValueChange={set("currencyId")}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih mata uang" />
          </SelectTrigger>
          <SelectContent>
            {currencies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Tipe Mutasi *</Label>
        <Select value={form.type} onValueChange={set("type")}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih tipe" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MUTATION_TYPE_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Jumlah *</Label>
        <Input
          type="number"
          min="0.0001"
          step="any"
          placeholder="0"
          value={form.quantity}
          onChange={(e) => set("quantity")(e.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label>Rate (IDR per 1 unit)</Label>
        <NumberInput
          placeholder="Opsional"
          value={form.rate}
          onValueChange={(val) => set("rate")(val === undefined ? "" : String(val))}
        />
        {form.rate && form.quantity && (
          <p className="text-xs text-muted-foreground">
            Nilai IDR ≈{" "}
            {(parseFloat(form.quantity) * parseFloat(form.rate)).toLocaleString("id-ID", {
              style: "currency",
              currency: "IDR",
              maximumFractionDigits: 0,
            })}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label>Catatan</Label>
        <Input
          placeholder="Opsional"
          value={form.note}
          onChange={(e) => set("note")(e.target.value)}
        />
      </div>
    </AdminFormSidebar>
  );
}
