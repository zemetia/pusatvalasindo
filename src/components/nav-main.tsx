"use client";

import { type Icon } from "@tabler/icons-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePathname, Link } from "@src/i18n/routing";

export function NavMain({
  items,
  label,
}: {
  items: {
    title: string;
    url: string;
    icon?: Icon;
    exact?: boolean;
  }[];
  label?: string;
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const isActive = item.exact
              ? pathname === item.url
              : pathname === item.url || pathname.startsWith(item.url + "/");
            
            return (
              <SidebarMenuItem key={item.title}>
                <Link href={item.url} className="w-full">
                  <SidebarMenuButton 
                    tooltip={item.title}
                    isActive={isActive}
                    className="relative transition-all duration-300 hover:translate-x-1 group/btn
                      data-[active=true]:bg-primary/10 
                      data-[active=true]:text-primary 
                      data-[active=true]:font-bold
                      data-[active=true]:shadow-[inset_2px_0_0_0_theme(colors.primary)]"
                  >
                    {item.icon && (
                      <item.icon 
                        className="size-4 opacity-70 group-hover/btn:opacity-100 group-data-[active=true]/btn:opacity-100 group-data-[active=true]/btn:text-primary transition-colors" 
                      />
                    )}
                    <span className="font-medium tracking-tight">{item.title}</span>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-primary rounded-r-full" />
                    )}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
