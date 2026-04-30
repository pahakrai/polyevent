'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getAllEvents } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { EventCard } from '@/components/EventCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'MUSIC', label: 'Music' },
  { value: 'ART', label: 'Art' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'ACTIVITIES', label: 'Activities' },
  { value: 'OTHER', label: 'Other' },
];

function EventsContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || '';
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(initialCategory);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const limit = 12;

  useEffect(() => {
    setLoading(true);
    getAllEvents(page, limit)
      .then((res) => {
        setEvents(res.data || []);
        setTotal(res.total || 0);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = category
    ? events.filter((e) => e.category === category)
    : events;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground">
            Discover upcoming events near you
          </p>
        </div>
        {isAuthenticated && (
          <Link
            href="/events/new"
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Create Event
          </Link>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className="rounded-full"
          >
            <Badge
              variant={category === cat.value ? 'default' : 'secondary'}
              className="cursor-pointer px-3 py-1 text-sm"
            >
              {cat.label}
            </Badge>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event, idx) => (
              <EventCard key={event.id} event={event} position={idx + 1} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-lg text-muted-foreground">No events found.</p>
              {isAuthenticated && (
                <Link
                  href="/events/new"
                  className="mt-2 inline-block text-sm font-medium text-primary underline"
                >
                  Create the first event
                </Link>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><Skeleton className="h-48 w-full rounded-lg" /></div>}>
      <EventsContent />
    </Suspense>
  );
}
