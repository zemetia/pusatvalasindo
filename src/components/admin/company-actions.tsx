"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CompanySheet } from "./company-sheet";
import type { CompanyRow } from "./company-sheet";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";

interface Props {
  company: CompanyRow;
  /** Jumlah data yang menggantung di PT ini — dipakai untuk memperingatkan sebelum hapus. */
  dependents: number;
}

export function CompanyActions({ company, dependents }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleToggleActive = async () => {
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !company.isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Gagal mengubah status");
      return;
    }
    toast.success(company.isActive ? "PT dinonaktifkan" : "PT diaktifkan");
    router.refresh();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menghapus PT");
        return;
      }
      toast.success("PT dihapus");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" onClick={handleToggleActive}>
        {company.isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>

      <CompanySheet
        company={company}
        trigger={
          <Button size="icon" variant="ghost">
            <IconPencil className="size-4" />
          </Button>
        }
      />

      <DeleteConfirmDialog
        trigger={
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={deleting}
          >
            <IconTrash className="size-4" />
          </Button>
        }
        title={`Hapus PT "${company.name}"?`}
        description={
          dependents > 0
            ? "PT ini masih menaungi cabang, jabatan, atau data lain — penghapusan akan ditolak. Nonaktifkan saja kalau PT sudah tidak beroperasi."
            : "Tindakan ini tidak bisa dibatalkan."
        }
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
