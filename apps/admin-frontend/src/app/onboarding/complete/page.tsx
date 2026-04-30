'use client';

import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboarding-store';

export default function OnboardingComplete() {
  const router = useRouter();
  const reset = useOnboardingStore((s) => s.reset);

  const handleGoToDashboard = () => {
    reset();
    router.push('/dashboard');
  };

  return (
    <div className="rounded-lg border bg-card p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="mb-2 text-2xl font-bold">You&apos;re all set!</h2>
      <p className="mb-6 text-muted-foreground">
        Your vendor profile is ready. You can now manage venues, time slots, and bookings from your dashboard.
      </p>
      <button onClick={handleGoToDashboard} className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Go to Dashboard
      </button>
    </div>
  );
}
