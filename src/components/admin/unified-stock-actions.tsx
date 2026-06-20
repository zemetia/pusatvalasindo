"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IconPencil, IconTrash, IconPower } from "@tabler/icons-react";
import { UnifiedStockSheet } from "./unified-stock-sheet";

interface Props {
  item: any;
  branchId: string;
  currencies: { id: string; code: string; name: string }[];
}

export function UnifiedStockActions({ item, branchId, currencies }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isBank = item.type === 'BANK_ACCOUNT';
  const baseUrl = isBank ? `/api/bank-accounts/${item.id}` : `/api/stock-items/${item.id}`;

  const handleToggleActive = async () => {
    setLoading(true);
    try {
      const res = await fetch(baseUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(item.isActive ? "Dinonaktifkan" : "Diaktifkan");
      router.refresh();
    } catch (error: any) {
      toast.error("Gagal: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Hapus "${item.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setLoading(true);
    try {
      const res = await fetch(baseUrl, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Berhasil dihapus");
      router.refresh();
    } catch (error: any) {
      toast.error("Gagal: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button 
        size="icon" 
        variant="ghost" 
        onClick={handleToggleActive} 
        disabled={loading}
        title={item.isActive ? "Nonaktifkan" : "Aktifkan"}
      >
        <IconPower className={`size-4 ${item.isActive ? "text-emerald-500" : "text-muted-foreground"}`} />
      </Button>

      <UnifiedStockSheet
        branchId={branchId}
        currencies={currencies}
        item={item}
        trigger={
          <Button size="icon" variant="ghost" disabled={loading}>
            <IconPencil className="size-4" />
          </Button>
        }
      />

      <Button
        size="icon"
        variant="ghost"
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
        disabled={loading}
        onClick={handleDelete}
      >
        <IconTrash className="size-4" />
      </Button>
    </div>
  );
}
