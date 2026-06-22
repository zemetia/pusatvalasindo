"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserSheet, UserRow } from "./user-sheet";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";

type Branch = { id: string; name: string; companyId: string | null };
type Company = { id: string; name: string };
type Role = { id: string; name: string; companyId: string | null };

interface Props {
  user: UserRow;
  branches: Branch[];
  companies: Company[];
  roles: Role[];
}

export function UserActions({ user, branches, companies, roles }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleToggleActive = async () => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "Gagal mengubah status");
      return;
    }
    toast.success(user.isActive ? "Pengguna dinonaktifkan" : "Pengguna diaktifkan");
    router.refresh();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menghapus pengguna");
        return;
      }
      toast.success("Pengguna dihapus");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" onClick={handleToggleActive}>
        {user.isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>

      <UserSheet
        user={user}
        branches={branches}
        companies={companies}
        roles={roles}
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
        title={`Hapus pengguna "${user.name}"?`}
        description={`Akun ${user.email} dan semua sesi akan dihapus. Tindakan ini tidak bisa dibatalkan.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
