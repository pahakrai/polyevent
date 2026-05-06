'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/admin-auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

const STEPS = [
  { num: 1, label: 'Business Profile' },
  { num: 2, label: 'Venues' },
  { num: 3, label: 'Time Slots' },
];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated);
  const step = useOnboardingStore((s) => s.step);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !localStorage.getItem('authToken')) {
      router.replace('/login');
    }
  }, [mounted, router]);

  if (!mounted) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold">Vendor Onboarding</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Step {step} of 3</span>
            <button
              onClick={async () => {
                const { logout } = useAdminAuthStore.getState();
                await logout();
                useOnboardingStore.getState().reset();
                router.push('/login');
              }}
              className="rounded-md border border-muted-foreground/30 px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-8 flex gap-2">
          {STEPS.map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${step >= s.num ? 'bg-primary text-primary-foreground' : 'border bg-muted text-muted-foreground'}`}>
                {s.num}
              </div>
              <span className={`text-sm ${step >= s.num ? 'font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
              {s.num < 3 && <div className="mx-2 h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {children}
      </div>
    </div>
  );
}
