'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuthStore } from '@/stores/admin-auth-store';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: 'G' },
  { href: '/dashboard/venues', label: 'Venues', icon: 'V' },
  { href: '/dashboard/events', label: 'Events', icon: 'E' },
  { href: '/dashboard/bookings', label: 'Bookings', icon: 'B' },
  { href: '/dashboard/insights', label: 'Insights', icon: 'I' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'S' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isVendor, user, logout } = useAdminAuthStore();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card">
        <div className="border-b px-6 py-4">
          <h1 className="text-lg font-bold">Polydom</h1>
          <p className="text-xs text-muted-foreground">{isVendor ? 'Vendor' : 'Admin'} Dashboard</p>
        </div>

        <nav className="space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${pathname === item.href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-muted-foreground/10 text-xs font-bold">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-64 border-t p-4">
          <div className="mb-2 text-sm font-medium">
            {user?.firstName} {user?.lastName}
          </div>
          <button onClick={() => { logout(); router.push('/login'); }} className="text-xs text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}
