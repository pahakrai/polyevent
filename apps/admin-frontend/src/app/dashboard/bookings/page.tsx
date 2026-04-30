'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Bookings would come from a booking service; for now show placeholder
        setBookings([]);
      } catch { /* no booking service yet */ } finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="animate-pulse">Loading...</div>;

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Bookings</h2>
      {bookings.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>No bookings yet. Bookings will appear here when users book your time slots.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b: any) => (
            <div key={b.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{b.eventTitle || 'Booking'}</h3>
                  <p className="text-sm text-muted-foreground">Status: {b.status}</p>
                </div>
                <span className="text-sm">{new Date(b.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
