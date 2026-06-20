"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useRouter, useParams } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Terminal } from "lucide-react";

import { IconLoader, IconMail, IconLock, IconArrowRight } from "@tabler/icons-react";

import { toast } from "sonner";

import { PremiumField } from "@/components/admin/premium-field";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: any) {
    e.preventDefault();

    const { data, error } = await authClient.signIn.email(
      {
        email,
        password,
        callbackURL: `/${locale}/dashboard`,
        rememberMe: false,
      },
      {
        onRequest: (ctx) => {
          setLoading(true);
          setError(""); 
        },
        onSuccess: (ctx) => {
          toast.success("Login berhasil!");
          router.push(`/${locale}/dashboard`);
        },
        onError: (ctx) => {
          setError(ctx.error.message);
          setLoading(false);
        },
      }
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-zinc-200 bg-white shadow-2xl shadow-zinc-200/60 overflow-hidden rounded-[2rem]">
          
          <CardHeader className="space-y-1.5 pb-8 pt-10">
            <CardTitle className="text-2xl font-bold tracking-tight text-center text-zinc-900">
              Sign In
            </CardTitle>
            <CardDescription className="text-center text-zinc-500 font-medium">
              Access the management portal
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-10">
            {error && (
              <Alert className="mb-6 border-red-200 bg-red-50 text-red-600 animate-in fade-in slide-in-from-top-1" variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertDescription className="font-semibold text-xs">{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
              <div className="space-y-4">
                <PremiumField
                  label="Email"
                  icon={<IconMail size={18} className="text-zinc-400" />}
                  type="email"
                  placeholder="name@pusatvalas.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
                
                <div className="space-y-1">
                  <PremiumField
                    label="Password"
                    icon={<IconLock size={18} className="text-zinc-400" />}
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <div className="flex justify-end pr-1">
                    <a
                      href="#"
                      className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      Forgot password?
                    </a>
                  </div>
                </div>
              </div>

              <Button 
                disabled={loading} 
                type="submit" 
                className="w-full h-12 bg-zinc-900 text-white hover:bg-zinc-800 transition-all duration-300 font-bold rounded-2xl group shadow-lg shadow-zinc-200"
              >
                {loading ? (
                  <IconLoader className="animate-spin" stroke={2} />
                ) : (
                  <span className="flex items-center justify-center gap-2 tracking-tight">
                    Continue to Dashboard
                    <IconArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>


    </div>
  );
}

