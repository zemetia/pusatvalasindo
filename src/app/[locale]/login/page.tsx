import { LoginForm } from "@/components/auth/login-form";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="relative min-h-svh w-full flex items-center justify-center overflow-hidden bg-zinc-50">
      {/* Background Soft Accents */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-red-100 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob" />
      <div className="absolute top-1/2 -right-24 w-96 h-96 bg-rose-50 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-2000" />
      
      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-grid-black opacity-[0.02]" />
      
      <div className="relative z-10 w-full max-w-[400px] px-6">
        <div className="mb-10 flex flex-col items-center">
          <div className="relative w-36 md:w-48 transition-transform hover:scale-105 duration-500">
            <Image 
              src="/images/logo/logo-red.png" 
              alt="Pusat Valas Indo Logo" 
              width={192} 
              height={60}
              className="w-full h-auto object-contain"
              priority
            />
          </div>
        </div>


        
        <LoginForm />
        
        <p className="mt-8 text-center text-xs text-zinc-500">
          &copy; {new Date().getFullYear()} Pusat Valas Indo. All rights reserved.
        </p>
      </div>
    </div>
  );
}

