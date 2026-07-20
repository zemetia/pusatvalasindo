"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { RoleSheet, RoleRow } from "./role-sheet";
import { IconPencil, IconTrash } from "@tabler/icons-react";

type CompanyOption = { id: string; name: string; code: string };

interface Props {
  role: RoleRow;
  currentCompanyId?: string;
  companies?: CompanyOption[];
}

export function RoleActions({ role, currentCompanyId, companies }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menghapus role");
        return;
      }
      toast.success("Role dihapus");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-1 justify-end">
      <RoleSheet
        role={role}
        currentCompanyId={currentCompanyId}
        companies={companies}
        trigger={
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/5 hover:text-primary transition-colors">
            <IconPencil className="size-4" />
          </Button>
        }
      />

      <DeleteConfirmDialog
        trigger={
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/5 transition-colors"
            disabled={deleting}
          >
            <IconTrash className="size-4" />
          </Button>
        }
        title={`Hapus role "${role.name}"?`}
        description="Tindakan ini tidak bisa dibatalkan."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
