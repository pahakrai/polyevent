"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Search,
  Music,
  Users,
  Calendar,
  TrendingUp,
  Settings,
  Home,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/category/CONCERT", label: "Concerts", icon: Music },
  { href: "/category/WORKSHOP", label: "Workshops", icon: Users },
  { href: "/category/JAM_SESSION", label: "Jam Sessions", icon: Calendar },
  { href: "/category/FESTIVAL", label: "Festivals", icon: TrendingUp },
];

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed && !mobileOpen ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
          {(!collapsed || mobileOpen) && (
            <Link
              href="/"
              className="font-heading text-lg font-bold tracking-tight text-sidebar-primary-foreground"
            >
              Polydom
            </Link>
          )}
          <button
            onClick={() => {
              setCollapsed((c) => !c);
              setMobileOpen(false);
            }}
            className="hidden rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {(!collapsed || mobileOpen) && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div
          className={cn(
            "flex items-center border-t border-sidebar-border px-3 py-3",
            collapsed && !mobileOpen ? "justify-center" : "justify-between",
          )}
        >
          {(!collapsed || mobileOpen) && (
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          )}
          <ThemeToggle className="border-sidebar-border bg-sidebar-accent text-sidebar-foreground/70 hover:bg-sidebar-border hover:text-sidebar-foreground" />
        </div>
      </aside>

      {/* Main content area */}
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300",
          collapsed ? "lg:ml-16" : "lg:ml-60",
        )}
      >
        {/* Top bar for mobile trigger */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur-md px-4 lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-muted-foreground">
            {NAV_ITEMS.find((i) => i.href === pathname)?.label ?? "Polydom"}
          </span>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
