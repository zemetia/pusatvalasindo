"use client";
import React, { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { useRouter, useParams } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [loading, setLoading] = useState(false);

  async function handleLogOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push(`/${locale}/login`); // redirect to login page
        },
        onRequest: (ctx) => {
          setLoading(true);
        },
        onResponse: (ctx) => {
          setLoading(false);
        },
      },
    });
  }
  return (
    <button onClick={() => handleLogOut()}>
      {loading ? "Logging out..." : "Log out"}
    </button>
  );
}
