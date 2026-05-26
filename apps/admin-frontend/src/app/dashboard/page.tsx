'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Users,
  DollarSign,
  Star,
  Calendar,
  Building2,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Sparkles,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { api } from '@/lib/api';

interface DashboardStats {
  totalEvents: number;
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  gradient,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  gradient: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
      <div className={`absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${gradient}`} />
      <div className="relative">
        <div className="mb-3 flex items-start justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <Icon className="h-5 w-5 text-muted-foreground/60" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {trend && (
            <span
              className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                trend === 'up'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {trend === 'up' ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              12%
            </span>
          )}
        </div>
        {sub && (
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        )}
        {/* Mini sparkline placeholder */}
        <div className="mt-3 flex items-end gap-0.5 h-6">
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-primary/30 transition-all group-hover:bg-primary/50"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, label, icon: Icon, accent }: { href: string; label: string; icon: React.ElementType; accent: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">Manage and configure</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
    </Link>
  );
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
        const { data: v } = await api.get(`/vendors/user/${payload.sub}`);
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
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      {vendor && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Welcome back, {vendor.businessName}
              {vendor.verificationStatus === 'VERIFIED' && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Verified
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Here&apos;s what&apos;s happening with your events today.
            </p>
          </div>
          <Link
            href="/dashboard/events"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40"
          >
            <Plus className="h-4 w-4" />
            Create Event
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Events"
          value={String(stats?.totalEvents ?? 0)}
          sub="+2 this month"
          icon={Calendar}
          trend="up"
          gradient="bg-gradient-to-br from-blue-500/5 to-indigo-500/5"
        />
        <StatCard
          label="Total Bookings"
          value={String(stats?.totalBookings ?? 0)}
          sub="85% fill rate"
          icon={Users}
          trend="up"
          gradient="bg-gradient-to-br from-emerald-500/5 to-teal-500/5"
        />
        <StatCard
          label="Revenue"
          value={`$${(stats?.totalRevenue ?? 0).toLocaleString()}`}
          sub="Last 30 days"
          icon={DollarSign}
          gradient="bg-gradient-to-br from-violet-500/5 to-purple-500/5"
        />
        <StatCard
          label="Rating"
          value={stats?.averageRating?.toFixed(1) ?? 'N/A'}
          sub={`${stats?.averageRating ? 'Top 20%' : 'No ratings yet'}`}
          icon={Star}
          gradient="bg-gradient-to-br from-amber-500/5 to-orange-500/5"
        />
      </div>

      {/* Quick actions & status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <div className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickAction
              href="/dashboard/venues"
              label="Manage Venues"
              icon={Building2}
              accent="bg-blue-500/10 text-blue-400"
            />
            <QuickAction
              href="/dashboard/events"
              label="View Events"
              icon={Calendar}
              accent="bg-violet-500/10 text-violet-400"
            />
            <QuickAction
              href="/dashboard/bookings"
              label="Recent Bookings"
              icon={BookOpen}
              accent="bg-emerald-500/10 text-emerald-400"
            />
            <QuickAction
              href="/dashboard/insights"
              label="AI Business Insights"
              icon={Sparkles}
              accent="bg-amber-500/10 text-amber-400"
            />
          </div>
        </div>

        {/* Account status */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Account Status
          </h3>
          <div className="rounded-xl border border-border/50 bg-card p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Verification</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    vendor?.verificationStatus === 'VERIFIED'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      vendor?.verificationStatus === 'VERIFIED'
                        ? 'bg-emerald-400'
                        : 'bg-amber-400'
                    }`}
                  />
                  {vendor?.verificationStatus || 'PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Venues</span>
                <span className="text-sm font-medium text-muted-foreground">-</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Upcoming Bookings</span>
                <span className="text-sm font-medium">{stats?.totalBookings ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Response Rate</span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  98%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Reports section */}
      {vendor && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              AI Business Reports
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              Powered by AI
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                href: `/dashboard/insights?goal=${encodeURIComponent('Analyze my revenue trends over the last 6 months')}`,
                title: 'Revenue Trends',
                desc: 'Monthly revenue breakdown by category',
                accent: 'border-l-blue-500',
              },
              {
                href: `/dashboard/insights?goal=${encodeURIComponent('How are my monthly bookings trending and what patterns do you see?')}`,
                title: 'Booking Analysis',
                desc: 'Trends, peaks, and category breakdown',
                accent: 'border-l-emerald-500',
              },
              {
                href: `/dashboard/insights?goal=${encodeURIComponent('Compare my event performance against market averages')}`,
                title: 'Market Comparison',
                desc: 'Benchmark fill rates and pricing vs market',
                accent: 'border-l-violet-500',
              },
              {
                href: `/dashboard/insights?goal=${encodeURIComponent('Which of my venues has the lowest utilization and why?')}`,
                title: 'Venue Utilization',
                desc: 'Time slot usage and underperforming venues',
                accent: 'border-l-amber-500',
              },
              {
                href: `/dashboard/insights?goal=${encodeURIComponent('Which events perform best and worst by fill rate?')}`,
                title: 'Event Performance',
                desc: 'Fill rates, bookings, and pricing analysis',
                accent: 'border-l-rose-500',
              },
              {
                href: '/dashboard/insights',
                title: 'Custom Report',
                desc: 'Ask any business question',
                accent: 'border-l-primary border-dashed',
              },
            ].map((report) => (
              <Link
                key={report.title}
                href={report.href}
                className={`group rounded-xl border border-border/50 bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-md ${report.accent} border-l-2`}
              >
                <p className="text-sm font-medium transition-colors group-hover:text-primary">
                  {report.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{report.desc}</p>
                <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  Run analysis
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for new vendors */}
      {!vendor && (
        <div className="rounded-xl border border-border/50 bg-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Set up your vendor profile</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete onboarding to unlock your dashboard and start receiving
            bookings.
          </p>
          <Link
            href="/onboarding/profile"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40"
          >
            Start Onboarding
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
