'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function BookPage() {
  const { timeslotId } = useParams<{ timeslotId: string }>();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [slot, setSlot] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data: s } = await api.get(`/timeslots/${timeslotId}`);
        setSlot(s);
        if (s.venueId) {
          const { data: v } = await api.get(`/venues/${s.venueId}`);
          setVenue(v);
        }
      } catch { setSlot(null); }
      finally { setLoading(false); }
    }
    load();
  }, [timeslotId]);

  useEffect(() => {
    if (!isAuthenticated) router.replace(`/login?redirect=/book/${timeslotId}`);
  }, [isAuthenticated, router, timeslotId]);

  const handleBook = async () => {
    setBooking(true);
    setError('');
    try {
      await api.post(`/timeslots/${timeslotId}/book`);
      router.push('/profile?booked=true');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  if (loading) return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-40 w-full" />
    </div>
  );

  if (!slot) return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="text-muted-foreground">Time slot not found.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Confirm Booking</h1>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold">{venue?.name || `Venue ${slot.venueId}`}</h2>
            {venue?.description && <p className="text-sm text-muted-foreground mt-1">{venue.description}</p>}
          </div>

          <div className="rounded-md bg-muted p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Date</span>
              <span className="font-medium">{new Date(slot.startTime).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Time</span>
              <span className="font-medium">
                {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Venue</span>
              <span className="font-medium">{venue?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Pricing</span>
              <span className="font-medium">{venue?.pricingModel || 'N/A'}{slot.priceOverride ? ` — $${slot.priceOverride.amount}` : ''}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={handleBook} disabled={booking} className="flex-1">
              {booking ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
