'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;
        const payload = JSON.parse(atob(token.split('.')[1]));
        const { data: v } = await api.get(`/vendors/user/${payload.sub}`);
        if (v?.id) {
          const { data } = await api.get(`/events/vendor/${v.id}`);
          setEvents(data.data || []);
        }
      } catch { /* no vendor yet */ } finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-muted" />)}</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Events</h2>
        <a href="/dashboard/events/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Create Event
        </a>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>No events yet. Events are created when users book your time slots.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event: any) => (
            <div key={event.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.startTime).toLocaleDateString()} — {event.status}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  event.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                  event.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {event.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
