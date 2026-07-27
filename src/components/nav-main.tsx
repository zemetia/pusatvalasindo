"use client";

import * as React from "react";
import { IconChevronRight, type Icon } from "@tabler/icons-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePathname, Link } from "@src/i18n/routing";

function NavMenu({
  items,
  pathname,
}: {
  items: {
    title: string;
    url: string;
    icon?: Icon;
    exact?: boolean;
  }[];
  pathname: string;
}) {
  return (
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
  );
}

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
  const storageKey = label ? `sidebar-section-open:${label}` : undefined;
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    if (!storageKey) return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null) setOpen(stored === "1");
  }, [storageKey]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (storageKey) window.localStorage.setItem(storageKey, next ? "1" : "0");
  };

  if (!label) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <NavMenu items={items} pathname={pathname} />
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="flex w-full cursor-pointer items-center justify-between hover:text-foreground transition-colors">
            {label}
            <IconChevronRight
              className={`size-3.5 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <NavMenu items={items} pathname={pathname} />
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
