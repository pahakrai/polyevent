'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  UserPlus,
  Clock,
  MapPin,
  Calendar,
  DollarSign,
  Check,
  X,
  Timer,
  AlertCircle,
  Lock,
  Unlock,
  Send,
  MoreHorizontal,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  getEvent,
  listInvitations,
  inviteUser,
  respondToRequest,
  disableInvites,
  enableInvites,
  confirmVendor,
  releaseVendor,
  rebookVendor,
} from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth-store';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
  COMPLETED: 'bg-blue-500/10 text-blue-400',
  POSTPONED: 'bg-amber-500/10 text-amber-400',
  SOLD_OUT: 'bg-violet-500/10 text-violet-400',
};

const VENDOR_STATUS_STYLES: Record<string, string> = {
  NONE: 'bg-muted text-muted-foreground',
  PENDING_CONFIRMATION: 'bg-amber-500/10 text-amber-400',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
};

const VENDOR_STATUS_LABELS: Record<string, string> = {
  NONE: 'No Vendor',
  PENDING_CONFIRMATION: 'Booking Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

function useCountdown(lockedAt: string | null, ttlSeconds: number) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!lockedAt) {
      setRemaining(null);
      setExpired(false);
      return;
    }
    const lockedTime = new Date(lockedAt).getTime();
    const calc = () => {
      const left = Math.max(0, ttlSeconds - (Date.now() - lockedTime) / 1000);
      setRemaining(left);
      if (left <= 0) setExpired(true);
    };
    calc();
    const i = setInterval(calc, 1000);
    return () => clearInterval(i);
  }, [lockedAt, ttlSeconds]);
  return { remaining, expired };
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id ?? '') as string;
  const user = useAdminAuthStore((s) => s.user);

  const [event, setEvent] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Action state
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const LOCK_TTL = parseInt(process.env.NEXT_PUBLIC_VENDOR_LOCK_TTL_SECONDS || '600', 10);
  const { remaining, expired } = useCountdown(event?.vendorLockedAt, LOCK_TTL);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const ev = await getEvent(id);
      setEvent(ev);
      const invs = await listInvitations(id);
      setInvitations(invs || []);
    } catch {
      /* handle error */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (label: string, fn: () => Promise<any>) => {
    setActionLoading(label);
    setActionError('');
    setActionSuccess('');
    try {
      const result = await fn();
      if (result) setEvent(result);
      setActionSuccess(label);
      setTimeout(() => setActionSuccess(''), 2500);
      await loadData();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const handleSendInvite = () =>
    handleAction('inviting', async () => {
      if (!inviteUserId.trim()) throw new Error('Enter a user ID');
      await inviteUser(id, inviteUserId.trim(), user?.id || '');
      setInviteUserId('');
      setShowInvite(false);
    });

  const pendingRequests = invitations.filter(
    (inv) => inv.type === 'USER_REQUEST' && inv.status === 'PENDING',
  );
  const allInvites = invitations.filter((inv) => inv.type === 'CREATOR_INVITE');
  const acceptedCount = invitations.filter((inv) => inv.status === 'ACCEPTED').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Event not found</h3>
        <Link href="/dashboard/events" className="mt-4 inline-block text-sm text-primary">
          Back to events
        </Link>
      </div>
    );
  }

  const loc = event.location || {};
  const price = event.price || {};
  const capacityPct = event.maxAttendees
    ? Math.min(((event.currentBookings || 0) / event.maxAttendees) * 100, 100)
    : 0;
  const isFull = event.maxAttendees && (event.currentBookings || 0) >= event.maxAttendees;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/dashboard/events"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Events
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">{event.title}</h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[event.status] || 'bg-muted text-muted-foreground'}`}
              >
                {event.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <MapPin className="mr-1 inline h-3.5 w-3.5" />
              {loc.city || loc.venueName || 'TBD'} &middot;{' '}
              {new Date(event.startTime).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Action error/success */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          {actionSuccess === 'inviting'
            ? 'Invitation sent'
            : actionSuccess === 'accepting'
              ? 'Request accepted'
              : actionSuccess === 'rejecting'
                ? 'Request rejected'
                : actionSuccess === 'disabling invites'
                  ? 'Invites disabled'
                  : actionSuccess === 'enabling invites'
                    ? 'Invites enabled'
                    : actionSuccess}
        </div>
      )}

      {/* 3-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left: Participants ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quota bar */}
          {event.maxAttendees && (
            <div className="rounded-xl border border-border/50 bg-card p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Capacity
                </h3>
                <span className="text-sm text-muted-foreground">
                  {event.currentBookings || 0} / {event.maxAttendees}
                  {isFull && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                      Full
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted">
                <div
                  className={`h-2.5 rounded-full transition-all ${isFull ? 'bg-red-500' : 'bg-primary'}`}
                  style={{ width: `${capacityPct}%` }}
                />
              </div>

              {/* Auto-disable warning */}
              {event.maxAttendees &&
                !isFull &&
                (event.currentBookings || 0) >= event.maxAttendees * 0.8 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    {(event.maxAttendees || 0) - (event.currentBookings || 0)} spots left
                    &mdash; invites will auto-disable when full
                  </p>
                )}
            </div>
          )}

          {/* Invite toggle + send invite */}
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                handleAction(
                  event.allowInvites ? 'disabling invites' : 'enabling invites',
                  () =>
                    event.allowInvites ? disableInvites(id) : enableInvites(id),
                )
              }
              disabled={actionLoading === 'disabling invites' || actionLoading === 'enabling invites'}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                event.allowInvites
                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400'
                  : 'bg-red-500/10 text-red-400 hover:bg-emerald-500/10 hover:text-emerald-400'
              }`}
            >
              {event.allowInvites ? (
                <>
                  <Unlock className="h-4 w-4" /> Invites Open
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Invites Closed
                </>
              )}
            </button>

            {!showInvite ? (
              <button
                onClick={() => setShowInvite(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25"
              >
                <UserPlus className="h-4 w-4" />
                Invite User
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="User ID"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                />
                <button
                  onClick={handleSendInvite}
                  disabled={actionLoading === 'inviting'}
                  className="rounded-lg bg-primary p-2 text-primary-foreground"
                >
                  <Send className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setShowInvite(false);
                    setInviteUserId('');
                    setInviteError('');
                  }}
                  className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Pending join requests */}
          {pendingRequests.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card">
              <div className="border-b border-border/50 px-5 py-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Pending Join Requests
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/10 px-1.5 text-[11px] font-bold text-amber-400">
                    {pendingRequests.length}
                  </span>
                </h3>
              </div>
              <div className="divide-y divide-border/30">
                {pendingRequests.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{inv.userId}</p>
                      <p className="text-xs text-muted-foreground">
                        Requested{' '}
                        {new Date(inv.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleAction('accepting', () => respondToRequest(inv.id, true))
                        }
                        disabled={actionLoading === 'accepting' || actionLoading === 'rejecting'}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accept
                      </button>
                      <button
                        onClick={() =>
                          handleAction('rejecting', () => respondToRequest(inv.id, false))
                        }
                        disabled={actionLoading === 'accepting' || actionLoading === 'rejecting'}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All invitations list */}
          <div className="rounded-xl border border-border/50 bg-card">
            <div className="border-b border-border/50 px-5 py-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                All Participants
                <span className="text-xs text-muted-foreground">
                  ({acceptedCount} accepted, {invitations.length} total)
                </span>
              </h3>
            </div>

            {invitations.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No participants yet. Invite users or wait for join requests.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {inv.userId.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{inv.userId}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.type === 'CREATOR_INVITE' ? 'Invited by you' : 'Requested to join'}
                          {' · '}
                          {new Date(inv.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        inv.status === 'ACCEPTED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : inv.status === 'REJECTED'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Vendor + Event Info ─────────────────────── */}
        <div className="space-y-4">
          {/* Vendor booking */}
          {event.vendorStatus !== 'NONE' && (
            <div className="rounded-xl border border-border/50 bg-card">
              <div className="border-b border-border/50 px-5 py-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Vendor Booking
                </h3>
              </div>
              <div className="space-y-3 p-5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${VENDOR_STATUS_STYLES[event.vendorStatus] || ''}`}
                >
                  {VENDOR_STATUS_LABELS[event.vendorStatus]}
                </span>

                {event.vendorStatus === 'PENDING_CONFIRMATION' && remaining != null && !expired && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                    <Timer className="h-4 w-4" />
                    <span className="font-mono">{fmtTime(remaining)}</span>
                    remaining
                  </div>
                )}
                {(expired || event.vendorStatus === 'CANCELLED') && (
                  <p className="text-sm text-red-400">
                    {expired ? 'Booking expired' : 'Booking cancelled'}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {(event.vendorStatus === 'PENDING_CONFIRMATION' && (!expired || remaining == null)) && (
                    <>
                      <button
                        onClick={() => handleAction('confirming', () => confirmVendor(id))}
                        disabled={actionLoading === 'confirming'}
                        className="w-full rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20"
                      >
                        <Check className="mr-1.5 inline h-4 w-4" />
                        Confirm Booking
                      </button>
                      <button
                        onClick={() => handleAction('releasing', () => releaseVendor(id))}
                        disabled={actionLoading === 'releasing'}
                        className="w-full rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20"
                      >
                        <X className="mr-1.5 inline h-4 w-4" />
                        Cancel Booking
                      </button>
                    </>
                  )}
                  {(expired || event.vendorStatus === 'CANCELLED') && (
                    <button
                      onClick={() => handleAction('rebooking', () => rebookVendor(id))}
                      disabled={actionLoading === 'rebooking'}
                      className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25"
                    >
                      <RefreshCw className="mr-1.5 inline h-4 w-4" />
                      Re-book Vendor
                    </button>
                  )}
                  {event.vendorStatus === 'CONFIRMED' && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                      <Check className="h-4 w-4" />
                      Vendor confirmed
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Event details */}
          <div className="rounded-xl border border-border/50 bg-card">
            <div className="border-b border-border/50 px-5 py-3">
              <h3 className="text-sm font-semibold">Event Details</h3>
            </div>
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium">
                  {price.price != null
                    ? `$${price.price}`
                    : price.minPrice != null
                      ? `$${price.minPrice}–$${price.maxPrice}`
                      : 'Free'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium">{event.category}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vendor ID</span>
                <span className="font-mono text-xs">{event.vendorId}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Time Slot</span>
                <span className="font-mono text-xs">{event.timeSlotId || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
