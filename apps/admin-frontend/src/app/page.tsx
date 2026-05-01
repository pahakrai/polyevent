'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/admin-auth-store';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      router.replace(isAuthenticated ? '/dashboard' : '/login');
    }
  }, [mounted, isAuthenticated, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}
