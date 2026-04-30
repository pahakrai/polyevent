"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";

const NAV_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/category/music", label: "Music" },
  { href: "/category/art", label: "Art" },
  { href: "/category/sports", label: "Sports" },
  { href: "/category/activities", label: "Activities" },
  { href: "/groups", label: "Groups" },
  { href: "/vendors", label: "Vendors" },
  { href: "/events", label: "Events" },
];

function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.push("/");
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-1.5"
      >
        <span className="hidden sm:inline">{user?.firstName || "Account"}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-card py-1 shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function DefaultLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
            {!mounted ? null : isAuthenticated ? (
              <UserMenu />
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="hidden h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:inline-flex"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Polydom — Connecting people through shared interests
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/search" className="hover:text-foreground transition-colors">
              Discover Activities
            </Link>
            <span>&middot;</span>
            <span>&copy; {new Date().getFullYear()} Polydom</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
