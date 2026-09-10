"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";

/**
 * Hanya menghapus sesi yang sudah kedaluwarsa — lihat catatan di
 * `/api/users/login-history` (DELETE). Sesi yang masih aktif tidak pernah
 * ikut terhapus lewat tombol ini, jadi tidak ada pengguna yang tiba-tiba
 * ter-logout.
 */
export function LoginHistoryDeleteButton({ expiredCount }: { expiredCount: number }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/users/login-history", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menghapus riwayat login");
        return;
      }
      toast.success(data.message || "Riwayat login kedaluwarsa dihapus");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DeleteConfirmDialog
      trigger={
        <Button size="sm" variant="outline" disabled={deleting || expiredCount === 0}>
          <IconTrash className="size-4" />
          Hapus Riwayat
        </Button>
      }
      title="Hapus riwayat login kedaluwarsa?"
      description={`${expiredCount} sesi yang sudah kedaluwarsa akan dihapus permanen. Sesi yang masih aktif (pengguna yang sedang login) tidak akan disentuh.`}
      onConfirm={handleDelete}
      loading={deleting}
    />
  );
}
