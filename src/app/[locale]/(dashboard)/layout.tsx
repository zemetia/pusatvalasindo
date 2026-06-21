import { AppSidebar } from "@/components/app-sidebar";
import prisma from "@/lib/prisma";

import { SiteHeader } from "@/components/site-header";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

import { redirect } from "next/navigation";

export default async function layout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      customRole: { select: { name: true, permissions: true } },
    },
  });

  if (!fullUser) {
    redirect(`/${locale}/login`);
  }

  const permissions = fullUser.customRole?.permissions ?? [];
  const sidebarUser = { name: fullUser.name, email: fullUser.email };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={sidebarUser} permissions={permissions} />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
