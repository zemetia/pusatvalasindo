import { AppSidebar } from "@/components/app-sidebar";

import { SiteHeader } from "@/components/site-header";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { getCallerRecord } from "@/backend/helpers/get-admin-caller";

import { redirect } from "next/navigation";

export default async function layout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  let caller;
  try {
    // Shared, request-cached lookup — pages rendered under this layout that also
    // call getCaller()/getAdminCaller() reuse this same session + user query
    // instead of hitting the database again.
    caller = await getCallerRecord();
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <pre className="max-w-2xl whitespace-pre-wrap break-all rounded bg-destructive/10 p-6 text-sm text-destructive font-mono border border-destructive/30">
          {`[Dashboard layout — DB error]\n\n${msg}`}
        </pre>
      </div>
    );
  }

  if (!caller) {
    redirect(`/${locale}/login`);
  }

  const permissions = caller.permissions;
  const sidebarUser = { name: caller.name, email: caller.email };

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
