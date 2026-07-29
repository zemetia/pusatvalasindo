"use client";

import { useState } from "react";
import {
  IconDotsVertical,
  IconLoader2,
  IconLogout,
  IconUserCircle,
} from "@tabler/icons-react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

type NavUserData = { name: string; email: string };

export function NavUser({ user }: { user: NavUserData }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogOut(e: Event) {
    e.preventDefault(); // jangan tutup dropdown dulu
    setLoggingOut(true);
    const toastId = toast.loading("Sedang keluar...");
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Berhasil keluar", { id: toastId });
          router.push(`/${locale}/login`);
        },
        onError: () => {
          toast.error("Gagal keluar, coba lagi", { id: toastId });
          setLoggingOut(false);
        },
      },
    });
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-300 rounded-xl"
            >
              <Avatar className="h-9 w-9 rounded-lg border border-primary/10 shadow-sm">
                <AvatarFallback className="rounded-lg bg-primary/5 text-primary font-bold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                <span className="truncate font-semibold tracking-tight text-premium">{user.name}</span>
                <span className="text-muted-foreground truncate text-[10px] font-medium uppercase tracking-wider opacity-70">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-3.5 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl p-2 shadow-xl"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-2 py-2 text-left text-sm">
                <Avatar className="h-10 w-10 rounded-lg border border-primary/5">
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold tracking-tight text-premium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuGroup className="gap-1 flex flex-col">
              <DropdownMenuItem
                onSelect={() => router.push(`/${locale}/dashboard/account`)}
                className="rounded-lg transition-colors focus:bg-primary/5 focus:text-primary"
              >
                <IconUserCircle className="size-4 opacity-70" />
                <span className="font-medium">Account Settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem
              onSelect={handleLogOut}
              disabled={loggingOut}
              className="rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors"
            >
              {loggingOut ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconLogout className="size-4" />
              )}
              <span className="font-medium">
                {loggingOut ? "Sedang keluar..." : "Log out"}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
