"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BranchRow } from "./branch-sheet";
import { BranchSheet } from "./branch-sheet";
import { IconPencil, IconTrash, IconPackage } from "@tabler/icons-react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import Link from "next/link";

interface Props {
  branch: BranchRow;
  companies: { id: string; name: string }[];
}

export function BranchActions({ branch, companies }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleToggleActive = async () => {
    const res = await fetch(`/api/branches/${branch.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !branch.isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Gagal mengubah status");
      return;
    }
    toast.success(branch.isActive ? "Cabang dinonaktifkan" : "Cabang diaktifkan");
    router.refresh();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/branches/${branch.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menghapus cabang");
        return;
      }
      toast.success("Cabang dihapus");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" onClick={handleToggleActive}>
        {branch.isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>

      <Button size="icon" variant="ghost" asChild>
        <Link href={`/dashboard/branches/${branch.id}/items`}>
          <IconPackage className="size-4" />
        </Link>
      </Button>

      <BranchSheet
        branch={branch}
        companies={companies}
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
        title={`Hapus cabang "${branch.name}"?`}
        description="Tindakan ini tidak bisa dibatalkan."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
