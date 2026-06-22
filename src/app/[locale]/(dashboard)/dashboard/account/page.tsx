"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconLoader, IconUserCircle } from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { PageHeader } from "@/components/admin/page-header";

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
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Separator />
        <div className="max-w-xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 pb-10">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<IconUserCircle className="size-5" />}
      />
      <Separator />

      <div className="max-w-xl flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Profil</CardTitle>
            <CardDescription>Perbarui nama dan email akun Anda.</CardDescription>
          </CardHeader>
          <CardContent>
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
                <Button disabled={loading} type="submit" className="w-full sm:w-auto px-8">
                  {loading ? (
                    <IconLoader className="animate-spin" stroke={2} />
                  ) : (
                    t("save")
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ChangePasswordForm />
      </div>
    </div>
  );
}
