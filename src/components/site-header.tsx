"use client";

import { Menu, PanelLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

function SidebarToggle() {
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="-ml-1 size-7"
      onClick={toggleSidebar}
      aria-label="Toggle Sidebar"
    >
      {isMobile ? <Menu className="size-5" /> : <PanelLeft className="size-4" />}
    </Button>
  );
}

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarToggle />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-semibold tracking-tight">Admin Console</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Action buttons could go here */}
        </div>
      </div>
    </header>
  );
}
