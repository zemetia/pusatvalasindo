"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { CurrencySheet, CurrencyRow } from "./currency-sheet";

interface Props {
  currency: CurrencyRow;
}

export function CurrencyActions({ currency }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleToggleActive = async () => {
    const res = await fetch(`/api/currencies/${currency.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currency.isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Gagal mengubah status");
      return;
    }
    toast.success(currency.isActive ? "Mata uang dinonaktifkan" : "Mata uang diaktifkan");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm(`Hapus mata uang "${currency.code}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/currencies/${currency.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menghapus");
        return;
      }
      toast.success("Mata uang dihapus");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" onClick={handleToggleActive}>
        {currency.isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>
      <CurrencySheet
        currency={currency}
        trigger={
          <Button size="icon" variant="ghost">
            <IconPencil className="size-4" />
          </Button>
        }
      />
      <Button
        size="icon"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        disabled={deleting}
        onClick={handleDelete}
      >
        <IconTrash className="size-4" />
      </Button>
    </div>
  );
}
