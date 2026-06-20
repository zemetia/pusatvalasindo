"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StockItemSheet, StockItemRow } from "./stock-item-sheet";
import { IconPencil, IconTrash } from "@tabler/icons-react";

type Branch = { id: string; name: string; companyId: string | null };
type Company = { id: string; name: string };

interface Props {
  item: {
    id: string;
    branchId: string;
    name: string;
    code: string | null;
    type: string;
    sortOrder: number;
    isActive: boolean;
  };
  branches: Branch[];
  companies: Company[];
}

export function StockItemActions({ item, branches, companies }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleToggleActive = async () => {
    const res = await fetch(`/api/stock-items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Gagal mengubah status");
      return;
    }
    toast.success(item.isActive ? "Item dinonaktifkan" : "Item diaktifkan");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm(`Hapus item "${item.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stock-items/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menghapus item");
        return;
      }
      toast.success("Item dihapus");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" onClick={handleToggleActive}>
        {item.isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>

      <StockItemSheet
        branches={branches}
        companies={companies}
        item={item}
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
