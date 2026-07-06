"use client";
import React, { useState } from "react";
import { IconLoader2, IconLogout } from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

interface LogoutButtonProps {
  className?: string;
}

export default function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [loading, setLoading] = useState(false);

  async function handleLogOut() {
    setLoading(true);
    const toastId = toast.loading("Sedang keluar...");
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Berhasil keluar", { id: toastId });
            router.push(`/${locale}/login`);
          },
          onError: () => {
            toast.error("Gagal keluar, coba lagi", { id: toastId });
          },
        },
      });
    } catch {
      toast.error("Gagal keluar, coba lagi", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogOut}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <IconLoader2 className="size-4 animate-spin" />
      ) : (
        <IconLogout className="size-4" />
      )}
      {loading ? "Sedang keluar..." : "Log out"}
    </button>
  );
}
