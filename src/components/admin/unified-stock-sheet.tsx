"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminFormSidebar } from "./admin-form-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconCoins, IconDiamond, IconCash, IconBuildingBank, IconBox } from "@tabler/icons-react";

const TYPES = [
  { value: "CURRENCY", label: "Mata Uang", icon: <IconCoins className="size-4" /> },
  { value: "GOLD", label: "Emas", icon: <IconDiamond className="size-4" /> },
  { value: "SILVER", label: "Perak", icon: <IconBox className="size-4" /> },
  { value: "CASH", label: "Kas", icon: <IconCash className="size-4" /> },
  { value: "BANK_ACCOUNT", label: "Rekening Bank", icon: <IconBuildingBank className="size-4" /> },
];

interface Props {
  branchId: string;
  currencies: { id: string; code: string; name: string }[];
  item?: any; // For edit mode
  trigger?: React.ReactNode;
}

export function UnifiedStockSheet({ branchId, currencies, item, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [type, setType] = useState(item?.type || "CURRENCY");
  
  // Form for StockItem
  const [stockForm, setStockForm] = useState({
    name: "",
    code: "",
    sortOrder: "0",
  });

  // Form for BankAccount
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    currencyId: currencies[0]?.id || "",
    note: "",
  });

  const isEdit = !!item;

  useEffect(() => {
    if (open) {
      if (item) {
        setType(item.type);
        if (item.type === 'BANK_ACCOUNT') {
          setBankForm({
            bankName: item.bankName || "",
            accountName: item.accountName || "",
            accountNumber: item.accountNumber ?? item.code ?? "",
            currencyId: item.currencyId || currencies[0]?.id || "",
            note: item.note || "",
          });
        } else {
          setStockForm({
            name: item.name,
            code: item.code || "",
            sortOrder: String(item.sortOrder || 0),
          });
        }
      } else {
        // Reset
        setType("CURRENCY");
        setStockForm({ name: "", code: "", sortOrder: "0" });
        setBankForm({
          bankName: "",
          accountName: "",
          accountNumber: "",
          currencyId: currencies[0]?.id || "",
          note: "",
        });
      }
    }
  }, [open, item, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (type === 'BANK_ACCOUNT') {
        const body = {
          branchId,
          bankName: bankForm.bankName,
          accountName: bankForm.accountName,
          accountNumber: bankForm.accountNumber,
          currencyId: bankForm.currencyId,
          note: bankForm.note,
        };
        const url = isEdit ? `/api/bank-accounts/${item.id}` : "/api/bank-accounts";
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const body = {
          branchId,
          name: stockForm.name,
          code: stockForm.code,
          type: type,
          sortOrder: parseInt(stockForm.sortOrder) || 0,
        };
        const url = isEdit ? `/api/stock-items/${item.id}` : "/api/stock-items";
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      toast.success(isEdit ? "Berhasil diperbarui" : "Berhasil ditambahkan");
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminFormSidebar
      open={open}
      onOpenChange={setOpen}
      title={isEdit ? `Edit ${item.name}` : "Tambah Stok Baru"}
      trigger={trigger}
      onSubmit={handleSubmit}
      footer={
        <Button type="submit" disabled={loading} className="w-full bg-[#820302] hover:bg-[#820302]/90">
          {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Stok"}
        </Button>
      }
    >
      <div className="space-y-6 py-4">
        {/* Type Selection */}
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Tipe Asset / Stok</Label>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={isEdit}
                onClick={() => setType(t.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  type === t.value 
                    ? "border-[#820302] bg-[#820302]/5 text-[#820302] font-bold" 
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                } ${isEdit && type !== t.value && "opacity-50 cursor-not-allowed"}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          {type === 'BANK_ACCOUNT' ? (
            <>
              <div className="grid gap-1.5">
                <Label>Nama Bank *</Label>
                <Input
                  placeholder="Contoh: BCA, Mandiri, BRI"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Atas Nama *</Label>
                <Input
                  placeholder="Nama pemilik rekening"
                  value={bankForm.accountName}
                  onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Nomor Rekening</Label>
                <Input
                  placeholder="Opsional"
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Mata Uang *</Label>
                <Select
                  value={bankForm.currencyId}
                  onValueChange={(v) => setBankForm({ ...bankForm, currencyId: v })}
                  disabled={isEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih mata uang" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Catatan</Label>
                <Input
                  placeholder="Opsional"
                  value={bankForm.note}
                  onChange={(e) => setBankForm({ ...bankForm, note: e.target.value })}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label>Nama Item *</Label>
                <Input
                  placeholder={type === 'CURRENCY' ? "Contoh: USD, SGD, JPY" : type === 'CASH' ? "Kas Kecil, Kas Besar" : "Emas 24K, Perak Batang"}
                  value={stockForm.name}
                  onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Kode Item</Label>
                <Input
                  placeholder="Opsional (maks 10 karakter)"
                  maxLength={10}
                  value={stockForm.code}
                  onChange={(e) => setStockForm({ ...stockForm, code: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Urutan Tampilan</Label>
                <Input
                  type="number"
                  min="0"
                  value={stockForm.sortOrder}
                  onChange={(e) => setStockForm({ ...stockForm, sortOrder: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AdminFormSidebar>
  );
}
