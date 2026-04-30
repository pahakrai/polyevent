'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function VenueDetailPage() {
  const { vendorId, venueId } = useParams<{ vendorId: string; venueId: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [venue, setVenue] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: v } = await api.get(`/venues/${venueId}`);
        setVenue(v);
        const { data: s } = await api.get(`/venues/${venueId}/timeslots`);
        setSlots((s.data || []).filter((sl: any) => sl.status === 'AVAILABLE'));
      } catch { setVenue(null); }
      finally { setLoading(false); }
    }
    load();
  }, [venueId]);

  if (loading) return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  if (!venue) return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <p className="text-muted-foreground">Venue not found.</p>
      <Link href={`/vendors/${vendorId}`} className="text-sm text-primary underline">Back to vendor</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={`/vendors/${vendorId}`} className="mb-4 inline-block text-sm text-muted-foreground hover:underline">
        &larr; Back to vendor
      </Link>

      <Card className="mb-8 p-6">
        <h1 className="text-2xl font-bold">{venue.name}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{venue.type}</span>
          <span>Capacity: {venue.capacity}</span>
          <span>Pricing: {venue.pricingModel}</span>
          {venue.hourlyRate && <span>${venue.hourlyRate}/hr</span>}
        </div>
        <p className="mt-3">{venue.description}</p>
        {venue.amenities?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {venue.amenities.map((a: string) => (
              <span key={a} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{a}</span>
            ))}
          </div>
        )}
      </Card>

      <h2 className="mb-4 text-xl font-bold">Available Time Slots ({slots.length})</h2>
      <div className="space-y-2">
        {slots.slice(0, 20).map((slot) => (
          <Card key={slot.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">
                {new Date(slot.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {slot.priceOverride && (
                <p className="text-sm font-medium">${slot.priceOverride.amount} {slot.priceOverride.currency}</p>
              )}
            </div>
            {isAuthenticated ? (
              <Link href={`/book/${slot.id}`}>
                <Button size="sm">Book Now</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="sm" variant="outline">Sign in to Book</Button>
              </Link>
            )}
          </Card>
        ))}
      </div>
      {slots.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">No available time slots.</p>
      )}
    </div>
  );
}
