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
    <SidebarMenu className="gap-0.5">
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.url
          : pathname === item.url || pathname.startsWith(item.url + "/");

        return (
          <SidebarMenuItem key={item.title}>
            <Link href={item.url} className="w-full">
              {/* Item aktif ditandai lewat latar lembut + ikon merah brand.
                  Tidak ada geser/bold saat hover — di daftar sepanjang ini
                  gerakan per item justru membuat sidebar terasa gelisah. */}
              <SidebarMenuButton
                tooltip={item.title}
                isActive={isActive}
                className="group/btn h-8 text-sm transition-colors
                  data-[active=true]:bg-primary/8
                  data-[active=true]:text-foreground
                  data-[active=true]:font-medium"
              >
                {item.icon && (
                  <item.icon className="text-muted-foreground group-hover/btn:text-foreground group-data-[active=true]/btn:text-primary size-4 transition-colors" />
                )}
                <span className="truncate">{item.title}</span>
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
          <SidebarGroupLabel className="text-muted-foreground/80 hover:text-foreground flex w-full cursor-pointer items-center justify-between text-[11px] font-medium tracking-wider uppercase transition-colors">
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
