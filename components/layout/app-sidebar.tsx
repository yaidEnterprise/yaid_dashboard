"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Boxes, ShieldCheck, User, PanelLeft, BookOpen } from "lucide-react";
import { cn } from "@/utils/utils";

const navItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Apps", url: "/apps", icon: Boxes },
  { title: "Proof Requests", url: "/proof-requests", icon: ShieldCheck },
  { title: "Perfil", url: "/settings", icon: User },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (url: string) =>
    pathname === url || pathname.startsWith(`${url}/`);

  const renderItem = (item: typeof navItems[number]) => {
    const active = isActive(item.url);
    return (
      <li key={item.title}>
        <Link
          href={item.url}
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            active && "bg-sidebar-accent text-sidebar-foreground font-medium shadow-[inset_2px_0_0_var(--color-sidebar-primary)]",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          {!collapsed && <span>{item.title}</span>}
        </Link>
      </li>
    );
  };

  const sidebarContent = (
    <div className={cn("flex h-full flex-col bg-sidebar border-r border-sidebar-border", collapsed ? "w-[60px]" : "w-[260px]")}>
      {/* Header */}
      <div className={cn("flex h-14 shrink-0 items-center justify-start border-b border-sidebar-border", collapsed ? "px-1.5" : "px-3")}>
        <div className={cn("flex shrink-0 items-center justify-center overflow-hidden", collapsed ? "h-10 w-10" : "h-12 w-12")}>
          <Image
            src="/yaid_icon.svg"
            alt="YaID"
            width={48}
            height={48}
            className="h-full w-full -translate-y-[13%] scale-[1.55] object-contain brightness-0 invert"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3">
        <ul className="space-y-0.5">
          {navItems.map(renderItem)}
        </ul>
        <ul className="mt-2 space-y-0.5 border-t border-sidebar-border pt-2">
          <li>
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <BookOpen className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              {!collapsed && <span>Documentação</span>}
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => {
          setCollapsed(false);
          setMobileOpen(true);
        }}
        className="lg:hidden fixed top-3.5 left-3 z-50 p-1.5 rounded-md text-text-secondary hover:bg-surface-muted hover:text-text-primary"
        aria-label="Open menu"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0">
        {sidebarContent}
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-text-tertiary shadow-sm hover:text-text-primary"
        >
          <PanelLeft className={cn("h-3 w-3 transition-transform", collapsed && "rotate-180")} />
        </button>
      </aside>
    </>
  );
}

export function useSidebarWidth() {
  // This is a simplified version — in the real app you'd use context
  return 260;
}
