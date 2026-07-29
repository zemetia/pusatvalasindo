"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/admin/page-shell";
import { IconLoader, IconLock } from "@tabler/icons-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export function ChangePasswordForm() {
  const t = useTranslations("Dashboard.Account.changePassword");
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Basic validation
    if (newPassword !== confirmPassword) {
      setError(t("mismatch"));
      return;
    }

    if (newPassword.length < 8) {
      setError(t("tooShort"));
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (authError) {
        setError(authError.message || t("error"));
        toast.error(authError.message || t("error"));
      } else {
        toast.success(t("success"));
        // Reset form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setError(t("error"));
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard
      title={t("title")}
      description={t("description")}
      icon={<IconLock className="size-4" />}
    >
        {error && (
          <Alert className="mb-4" variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="newPassword">{t("newPassword")}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <Button disabled={loading} type="submit" className="mt-2">
            {loading ? (
              <IconLoader className="animate-spin" stroke={2} />
            ) : (
              t("submit")
            )}
          </Button>
        </form>
    </SectionCard>
  );
}
