'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  MapPin,
  Users,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
  COMPLETED: 'bg-blue-500/10 text-blue-400',
  POSTPONED: 'bg-amber-500/10 text-amber-400',
  SOLD_OUT: 'bg-violet-500/10 text-violet-400',
};

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

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
      } catch {
        /* no vendor yet */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered =
    filter === 'all'
      ? events
      : events.filter((e) => e.status === filter.toUpperCase());

  const statusCounts = events.reduce(
    (acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Events</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {events.length} total events
          </p>
        </div>
        <Link
          href="/dashboard/events/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40"
        >
          <Plus className="h-4 w-4" />
          Create Event
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card p-1">
        {[
          { key: 'all', label: 'All', count: events.length },
          { key: 'PUBLISHED', label: 'Published', count: statusCounts['PUBLISHED'] || 0 },
          { key: 'DRAFT', label: 'Drafts', count: statusCounts['DRAFT'] || 0 },
          { key: 'COMPLETED', label: 'Completed', count: statusCounts['COMPLETED'] || 0 },
          { key: 'CANCELLED', label: 'Cancelled', count: statusCounts['CANCELLED'] || 0 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              filter === tab.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                filter === tab.key
                  ? 'bg-primary-foreground/20'
                  : 'bg-muted'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Events table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Calendar className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">No events found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {filter === 'all'
              ? "You haven't created any events yet."
              : `No events with status "${filter}".`}
          </p>
          {filter === 'all' && (
            <Link
              href="/dashboard/events/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Create your first event
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Event
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bookings
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Price
                </th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => {
                const loc = event.location || {};
                const price = event.price || {};
                return (
                  <tr
                    key={event.id}
                    className="border-b border-border/30 transition-colors hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/dashboard/events/${event.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {loc.city || loc.venueName || 'TBD'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(event.startTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLES[event.status] || 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            event.status === 'PUBLISHED'
                              ? 'bg-emerald-400'
                              : event.status === 'CANCELLED'
                                ? 'bg-red-400'
                                : 'bg-muted-foreground'
                          }`}
                        />
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">
                          {event.currentBookings || 0}
                          {event.maxAttendees ? ` / ${event.maxAttendees}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium">
                        {price.price != null
                          ? `$${price.price}`
                          : price.minPrice != null
                            ? `$${price.minPrice}–$${price.maxPrice}`
                            : 'Free'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
