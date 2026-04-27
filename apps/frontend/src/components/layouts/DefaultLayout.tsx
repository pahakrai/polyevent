"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/category/CONCERT", label: "Concerts" },
  { href: "/category/WORKSHOP", label: "Workshops" },
  { href: "/category/JAM_SESSION", label: "Jam Sessions" },
];

export function DefaultLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* Brand */}
          <Link
            href="/"
            className="font-heading text-xl font-bold tracking-tight text-primary transition-colors hover:text-primary/80"
          >
            Polydom
          </Link>

          {/* Nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname === link.href ||
                    (link.href !== "/search" && pathname.startsWith(link.href))
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Polydom — Connecting musicians with live events
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/search" className="hover:text-foreground transition-colors">
              Browse Events
            </Link>
            <span>&middot;</span>
            <span>&copy; {new Date().getFullYear()} Polydom</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
