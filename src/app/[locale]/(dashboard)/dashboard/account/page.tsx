"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconLoader, IconUserCircle } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { PageShell, PageHeader, SectionCard } from "@/components/admin/page-shell";

export default function Page() {
  const t = useTranslations("Dashboard.Account");

  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function getUser() {
    const { data: session } = await authClient.getSession();
    return session;
  }

  useEffect(() => {
    getUser().then((data) => {
      setFullname(data?.user?.name ?? "");
      setEmail(data?.user?.email ?? "");
    });
  }, []);

  if (!email) {
    return (
      <PageShell width="narrow">
        <div className="flex items-center gap-3 border-b pb-5">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<IconUserCircle className="size-5" />}
      />

      <SectionCard
        title="Informasi Profil"
        description="Perbarui nama dan email akun Anda."
      >
        <form className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t("fullName")}</Label>
            <Input
              onChange={(e) => setFullname(e.target.value)}
              value={fullname}
              id="name"
              type="text"
              placeholder="Nama lengkap"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              id="email"
              type="email"
              placeholder="email@contoh.com"
              required
            />
          </div>
          <div>
            <Button disabled={loading} type="submit" className="w-full sm:w-auto sm:px-8">
              {loading ? <IconLoader className="animate-spin" stroke={2} /> : t("save")}
            </Button>
          </div>
        </form>
      </SectionCard>

      <ChangePasswordForm />
    </PageShell>
  );
}
