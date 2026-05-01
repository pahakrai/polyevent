'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface DashboardStats {
  totalEvents: number;
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.sub;
        const { data: v } = await api.get(`/vendors/user/${userId}`);
        setVendor(v);
        if (v?.id) {
          const { data: s } = await api.get(`/vendors/${v.id}/stats`);
          setStats(s);
        }
      } catch {
        // Vendor may not exist yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">
        {vendor ? `Welcome, ${vendor.businessName}` : 'Dashboard'}
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Events</p>
          <p className="text-2xl font-bold">{stats?.totalEvents ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Bookings</p>
          <p className="text-2xl font-bold">{stats?.totalBookings ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Revenue</p>
          <p className="text-2xl font-bold">${(stats?.totalRevenue ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Rating</p>
          <p className="text-2xl font-bold">{stats?.averageRating?.toFixed(1) ?? 'N/A'}</p>
        </div>
      </div>

      {!vendor && (
        <div className="mt-8 rounded-lg border bg-card p-6 text-center">
          <h3 className="mb-2 text-lg font-semibold">Set up your vendor profile</h3>
          <p className="mb-4 text-sm text-muted-foreground">Complete onboarding to start receiving bookings.</p>
          <a href="/onboarding/profile" className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Start Onboarding
          </a>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold">Quick Actions</h3>
          <div className="space-y-2">
            <a href="/dashboard/venues" className="block rounded-md border p-3 text-sm hover:bg-muted">Manage Venues</a>
            <a href="/dashboard/events" className="block rounded-md border p-3 text-sm hover:bg-muted">View Events</a>
            <a href="/dashboard/bookings" className="block rounded-md border p-3 text-sm hover:bg-muted">Recent Bookings</a>
            <a href="/dashboard/insights" className="block rounded-md border p-3 text-sm hover:bg-muted font-medium text-primary">AI Business Insights</a>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold">Account Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1">
              <span>Verification</span>
              <span className={`font-medium ${vendor?.verificationStatus === 'VERIFIED' ? 'text-green-600' : 'text-yellow-600'}`}>
                {vendor?.verificationStatus || 'PENDING'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Active Venues</span>
              <span className="font-medium">-</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Upcoming Bookings</span>
              <span className="font-medium">{stats?.totalBookings ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {vendor && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">AI Business Reports</h3>
            <span className="text-xs text-muted-foreground">Powered by agent analysis</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href={`/dashboard/insights?goal=${encodeURIComponent('Analyze my revenue trends over the last 6 months')}`}
              className="rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-colors group"
            >
              <p className="text-sm font-medium group-hover:text-primary">Revenue Trends</p>
              <p className="mt-1 text-xs text-muted-foreground">Monthly revenue breakdown by category</p>
            </a>
            <a
              href={`/dashboard/insights?goal=${encodeURIComponent('How are my monthly bookings trending and what patterns do you see?')}`}
              className="rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-colors group"
            >
              <p className="text-sm font-medium group-hover:text-primary">Booking Analysis</p>
              <p className="mt-1 text-xs text-muted-foreground">Trends, peaks, and category breakdown</p>
            </a>
            <a
              href={`/dashboard/insights?goal=${encodeURIComponent('Compare my event performance against market averages')}`}
              className="rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-colors group"
            >
              <p className="text-sm font-medium group-hover:text-primary">Market Comparison</p>
              <p className="mt-1 text-xs text-muted-foreground">Benchmark fill rates and pricing vs market</p>
            </a>
            <a
              href={`/dashboard/insights?goal=${encodeURIComponent('Which of my venues has the lowest utilization and why?')}`}
              className="rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-colors group"
            >
              <p className="text-sm font-medium group-hover:text-primary">Venue Utilization</p>
              <p className="mt-1 text-xs text-muted-foreground">Time slot usage and underperforming venues</p>
            </a>
            <a
              href={`/dashboard/insights?goal=${encodeURIComponent('Which events perform best and worst by fill rate?')}`}
              className="rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-colors group"
            >
              <p className="text-sm font-medium group-hover:text-primary">Event Performance</p>
              <p className="mt-1 text-xs text-muted-foreground">Fill rates, bookings, and pricing analysis</p>
            </a>
            <a
              href="/dashboard/insights"
              className="rounded-lg border border-dashed bg-muted/20 p-4 hover:border-primary/50 hover:shadow-sm transition-colors group flex flex-col items-center justify-center text-center"
            >
              <p className="text-sm font-medium text-muted-foreground group-hover:text-primary">Custom Report</p>
              <p className="mt-1 text-xs text-muted-foreground">Ask any business question</p>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
