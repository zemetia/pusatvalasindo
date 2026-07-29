"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IconPencil, IconPower } from "@tabler/icons-react";
import { CompanyStockSheet } from "./company-stock-sheet";

type CompanyStockItem = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  sortOrder: number;
  isActive: boolean;
};

interface Props {
  item: CompanyStockItem;
  companyId: string;
}

export function CompanyStockActions({ item, companyId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const baseUrl = `/api/company-stock-items/${item.id}`;

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
    } catch (error) {
      toast.error("Gagal: " + (error instanceof Error ? error.message : String(error)));
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
        <IconPower className={`size-4 ${item.isActive ? "text-success" : "text-muted-foreground"}`} />
      </Button>

      <CompanyStockSheet
        companyId={companyId}
        item={item}
        trigger={
          <Button size="icon" variant="ghost" disabled={loading}>
            <IconPencil className="size-4" />
          </Button>
        }
      />
    </div>
  );
}
