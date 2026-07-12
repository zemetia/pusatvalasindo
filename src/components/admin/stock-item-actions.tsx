"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StockItemSheet, StockItemRow } from "./stock-item-sheet";
import { IconPencil } from "@tabler/icons-react";

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
    </div>
  );
}
