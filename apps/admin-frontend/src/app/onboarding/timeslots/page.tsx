'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { api } from '@/lib/api';

const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function OnboardingTimeslots() {
  const router = useRouter();
  const { venueId, setStep } = useOnboardingStore();
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [daysActive, setDaysActive] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!venueId) {
      setStep(2);
      router.push('/onboarding/venues');
    }
  }, [venueId, router, setStep]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleCreateSlots = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/venues/${venueId}/timeslots/bulk`, {
        venueId,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        daysOfWeek: selectedDays,
        startTime,
        endTime,
      });
      router.push('/onboarding/complete');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create time slots');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/complete');
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-1 text-xl font-semibold">Set up your weekly schedule</h2>
      <p className="mb-6 text-sm text-muted-foreground">Define when your venue is available for bookings each week.</p>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={daysActive} onChange={(e) => setDaysActive(e.target.checked)} />
          <span className="text-sm font-medium">I want to set up a weekly schedule</span>
        </label>

        {daysActive && (
          <>
            <div>
              <label className="text-sm font-medium">Available Days</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${selectedDays.includes(day.value) ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <input type="time" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">End Time</label>
                <input type="time" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={() => { setStep(2); router.push('/onboarding/venues'); }} className="rounded-md border px-4 py-2 text-sm">
            Back
          </button>
          {daysActive ? (
            <button onClick={handleCreateSlots} disabled={loading || selectedDays.length === 0} className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Schedule & Finish'}
            </button>
          ) : (
            <button onClick={handleSkip} className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Skip — I&apos;ll add slots later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
