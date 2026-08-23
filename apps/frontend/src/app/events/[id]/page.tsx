"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  Share2,
  MapPin,
  Clock,
  Users,
  UserPlus,
  X,
  Check,
  Timer,
  Lock,
  AlertCircle,
} from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { EventAttributes } from "@/components/EventAttributes";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  getEvent,
  getEventTypes,
  getEventsByCategory,
  confirmVendor,
  releaseVendor,
  rebookVendor,
  requestJoin,
  inviteUser,
  listInvitations,
  respondToRequest,
  disableInvites,
  enableInvites,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Vendor status badge mapping ─────────────────────────────────────
const VENDOR_STATUS_COLORS: Record<string, string> = {
  NONE: "bg-muted text-muted-foreground",
  PENDING_CONFIRMATION: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  CONFIRMED: "bg-green-500/10 text-green-500 border-green-500/30",
  CANCELLED: "bg-red-500/10 text-red-500 border-red-500/30",
};

const VENDOR_STATUS_LABELS: Record<string, string> = {
  NONE: "No Vendor",
  PENDING_CONFIRMATION: "Booking Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

// ── Countdown hook ──────────────────────────────────────────────────
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
      const elapsed = (Date.now() - lockedTime) / 1000;
      const left = Math.max(0, ttlSeconds - elapsed);
      setRemaining(left);
      if (left <= 0) setExpired(true);
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [lockedAt, ttlSeconds]);

  return { remaining, expired };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Page component ──────────────────────────────────────────────────
export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id ?? "") as string;
  const { trackPageView, trackEventView, trackEventSave, trackEventShare } =
    useAnalytics();
  const { isAuthenticated, user } = useAuthStore();

  const [event, setEvent] = useState<any>(null);
  const [eventType, setEventType] = useState<any>(null);
  const [similarEvents, setSimilarEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // Invitations
  const [invitations, setInvitations] = useState<any[]>([]);
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteError, setInviteError] = useState("");

  // Join request
  const [joinStatus, setJoinStatus] = useState<"idle" | "requested" | "accepted">("idle");
  const [actionLoading, setActionLoading] = useState("");
  const [actionError, setActionError] = useState("");

  const LOCK_TTL = parseInt(process.env.NEXT_PUBLIC_VENDOR_LOCK_TTL_SECONDS || '600', 10);

  const { remaining, expired } = useCountdown(
    event?.vendorLockedAt,
    LOCK_TTL,
  );

  // ── Resolve the event's type definition ────────────────────────────
  useEffect(() => {
    if (!event?.eventTypeId) return;
    getEventTypes()
      .then((types) => {
        setEventType(types.find((t) => t.id === event.eventTypeId) ?? null);
      })
      .catch(() => setEventType(null));
  }, [event?.eventTypeId]);

  // ── Load event ─────────────────────────────────────────────────────
  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getEvent(id)
      .then((data) => {
        setEvent(data);
        trackEventView(data.id, data.category, data.tags);
        // Load invitations if authenticated
        if (isAuthenticated) {
          loadInvitations(data.id);
        }
        return getEventsByCategory(data.category, 1, 6);
      })
      .then((res) => {
        setSimilarEvents((res?.data || []).filter((e: any) => e.id !== id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, isAuthenticated]);

  const loadInvitations = async (eventId: string) => {
    try {
      const data = await listInvitations(eventId);
      setInvitations(data || []);
      // Check if current user has a join request
      const myReq = (data || []).find(
        (inv: any) =>
          inv.userId === user?.id && inv.type === "USER_REQUEST",
      );
      if (myReq) {
        setJoinStatus(myReq.status === "ACCEPTED" ? "accepted" : "requested");
      }
    } catch {}
  };

  // ── Handlers ───────────────────────────────────────────────────────
  const handleSave = () => {
    if (!saved && event) {
      trackEventSave(event.id, event.category);
      setSaved(true);
    }
  };

  const handleShare = () => {
    if (event) {
      const url = window.location.href;
      navigator.clipboard?.writeText(url).then(() => {
        trackEventShare(event.id, "copy_link");
        alert("Link copied to clipboard!");
      });
    }
  };

  const handleAction = async (
    label: string,
    fn: () => Promise<any>,
    onSuccess?: () => void,
  ) => {
    setActionLoading(label);
    setActionError("");
    try {
      const result = await fn();
      if (result) setEvent(result);
      onSuccess?.();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || "Action failed");
    } finally {
      setActionLoading("");
    }
  };

  const handleConfirmVendor = () =>
    handleAction("confirming", () => confirmVendor(id));

  const handleReleaseVendor = () =>
    handleAction("releasing", () => releaseVendor(id));

  const handleRebookVendor = () =>
    handleAction("rebooking", () => rebookVendor(id));

  const handleRequestJoin = () =>
    handleAction("requesting", () => requestJoin(id, user?.id || ""), () => {
      setJoinStatus("requested");
      loadInvitations(id);
    });

  const handleSendInvite = () =>
    handleAction("inviting", async () => {
      if (!inviteUserId.trim()) throw new Error("Enter a user ID");
      await inviteUser(id, inviteUserId.trim(), user?.id || "");
      setInviteUserId("");
      setShowInviteInput(false);
      loadInvitations(id);
    });

  const handleRespond = (invitationId: string, accept: boolean) =>
    handleAction(accept ? "accepting" : "rejecting", async () => {
      await respondToRequest(invitationId, accept);
      loadInvitations(id);
    });

  const handleToggleInvites = () =>
    handleAction(
      event?.allowInvites ? "disabling invites" : "enabling invites",
      async () => {
        const result = event?.allowInvites
          ? await disableInvites(id)
          : await enableInvites(id);
        if (result) setEvent(result);
      },
    );

  // ── Derived state ──────────────────────────────────────────────────
  const isCreator =
    isAuthenticated && event?.vendorId && user?.id;

  const vendorStatus = event?.vendorStatus || "NONE";
  const hasVendor = vendorStatus !== "NONE";

  const capacityPercent = event?.maxAttendees
    ? Math.min(
        ((event.currentBookings || 0) / event.maxAttendees) * 100,
        100,
      )
    : 0;

  const isFull =
    event?.maxAttendees &&
    (event.currentBookings || 0) >= event.maxAttendees;

  // ── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Event Not Found</h1>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const loc = event.location || {};
  const price = event.price || {};
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="accent" className="uppercase tracking-wider">
            {event.category.replace(/_/g, " ")}
          </Badge>
          {eventType && (
            <Badge variant="secondary" className="uppercase tracking-wider">
              {eventType.name}
            </Badge>
          )}
          {hasVendor && (
            <Badge
              variant="outline"
              className={VENDOR_STATUS_COLORS[vendorStatus]}
            >
              {VENDOR_STATUS_LABELS[vendorStatus]}
            </Badge>
          )}
          {!event.allowInvites && (
            <Badge variant="destructive" className="text-xs">
              <Lock className="mr-1 h-3 w-3" /> Invites Closed
            </Badge>
          )}
          {isFull && (
            <Badge variant="destructive" className="text-xs">
              Full
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold">{event.title}</h1>
        <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {startDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span>
            {startDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            –{" "}
            {endDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Action Error */}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="mb-6">
            <CardContent className="p-6">
              <h2 className="mb-3 text-lg font-semibold">Description</h2>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {event.description}
              </p>
            </CardContent>
          </Card>

          {event.attributes && Object.keys(event.attributes).length > 0 && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="mb-3 text-lg font-semibold">Event Details</h2>
                <EventAttributes
                  attributes={event.attributes}
                  attributesSchema={eventType?.attributesSchema}
                />
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardContent className="p-6">
              <h2 className="mb-3 text-lg font-semibold">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {event.tags?.map((tag: string) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
                {(!event.tags || event.tags.length === 0) && (
                  <span className="text-sm text-muted-foreground">No tags</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Capacity bar */}
          {event.maxAttendees && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" /> Capacity
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {event.currentBookings || 0} / {event.maxAttendees}
                  </span>
                </div>
                <div className="mt-3 w-full rounded-full bg-muted h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      isFull ? "bg-red-500" : "bg-primary"
                    }`}
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <Card className="sticky top-20">
            <CardContent className="space-y-4 p-6">
              {/* Location */}
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Location
                </h3>
                <p className="mt-1 flex items-center gap-1 text-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {loc.venueName || loc.name || "Venue TBD"}
                </p>
                {loc.address && (
                  <p className="text-sm text-muted-foreground">{loc.address}</p>
                )}
                {loc.city && (
                  <p className="text-sm text-muted-foreground">
                    {loc.city}
                    {loc.country ? `, ${loc.country}` : ""}
                  </p>
                )}
              </div>

              {/* Price */}
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Price
                </h3>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {price.price != null
                    ? `$${price.price}`
                    : price.minPrice != null
                      ? `$${price.minPrice} – $${price.maxPrice}`
                      : "Free"}
                </p>
                {price.currency && price.currency !== "USD" && (
                  <span className="text-xs text-muted-foreground">
                    {price.currency}
                  </span>
                )}
              </div>

              {/* Book Now button */}
              {event.status === 'PUBLISHED' && (
                <div className="pt-2">
                  <Link
                    href={`/checkout?eventId=${event.id}&vendorId=${event.vendorId}&amount=${Math.round((price.price || 0) * 100)}&title=${encodeURIComponent(event.title)}`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40"
                  >
                    Book Now
                    <span className="text-xs opacity-70">
                      {price.price != null
                        ? `€${price.price}`
                        : price.minPrice != null
                          ? `€${price.minPrice}`
                          : 'Free'}
                    </span>
                  </Link>
                  <p className="mt-1 text-center text-[10px] text-muted-foreground">
                    {price.price ? 'Secured payment via Stripe' : 'No payment required'}
                  </p>
                </div>
              )}

              {/* Vendor booking section */}
              {hasVendor && (
                <div className="rounded-md border border-border p-3">
                  <h3 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
                    Vendor Booking
                  </h3>

                  {vendorStatus === "PENDING_CONFIRMATION" && (
                    <>
                      {remaining != null && !expired && (
                        <div className="mb-3 flex items-center gap-2 text-sm">
                          <Timer className="h-4 w-4 text-yellow-500" />
                          <span className="font-mono text-yellow-500">
                            {formatTime(remaining)}
                          </span>
                          <span className="text-muted-foreground">
                            remaining to confirm
                          </span>
                        </div>
                      )}
                      {(expired || (remaining != null && remaining <= 0)) && (
                        <div className="mb-3 flex items-center gap-2 text-sm text-red-500">
                          <AlertCircle className="h-4 w-4" />
                          Booking expired
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
                        {(!expired || remaining == null) && (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={handleConfirmVendor}
                            disabled={actionLoading === "confirming"}
                          >
                            {actionLoading === "confirming"
                              ? "Confirming..."
                              : "Confirm Booking"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={handleReleaseVendor}
                          disabled={actionLoading === "releasing"}
                        >
                          {actionLoading === "releasing"
                            ? "Releasing..."
                            : "Cancel Booking"}
                        </Button>
                        {(expired || vendorStatus === "CANCELLED") && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={handleRebookVendor}
                            disabled={actionLoading === "rebooking"}
                          >
                            {actionLoading === "rebooking"
                              ? "Re-booking..."
                              : "Re-book Vendor"}
                          </Button>
                        )}
                      </div>
                    </>
                  )}

                  {vendorStatus === "CONFIRMED" && (
                    <div className="flex items-center gap-2 text-sm text-green-500">
                      <Check className="h-4 w-4" />
                      Vendor confirmed
                    </div>
                  )}

                  {vendorStatus === "CANCELLED" && (
                    <div className="flex items-center gap-2 text-sm text-red-500">
                      <X className="h-4 w-4" />
                      Booking cancelled
                      <Button
                        size="sm"
                        variant="secondary"
                        className="ml-auto"
                        onClick={handleRebookVendor}
                        disabled={actionLoading === "rebooking"}
                      >
                        Re-book
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Join / Invite Section */}
              {isAuthenticated && (
                <div className="space-y-2">
                  {/* Join request (for non-creator users) */}
                  {joinStatus === "idle" && event.allowInvites && !isFull && (
                    <Button
                      className="w-full"
                      onClick={handleRequestJoin}
                      disabled={actionLoading === "requesting"}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {actionLoading === "requesting"
                        ? "Requesting..."
                        : "Request to Join"}
                    </Button>
                  )}
                  {joinStatus === "requested" && (
                    <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 px-3 py-2 text-sm text-yellow-500">
                      <Clock className="h-4 w-4" />
                      Join request pending
                    </div>
                  )}
                  {joinStatus === "accepted" && (
                    <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-500">
                      <Check className="h-4 w-4" />
                      You're attending
                    </div>
                  )}

                  {/* Creator controls */}
                  {/* Invite toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleToggleInvites}
                    disabled={
                      actionLoading === "disabling invites" ||
                      actionLoading === "enabling invites"
                    }
                  >
                    {event.allowInvites ? "Disable Invites" : "Enable Invites"}
                  </Button>

                  {/* Send invite */}
                  {!showInviteInput ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowInviteInput(true)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite User
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="User ID"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={inviteUserId}
                        onChange={(e) => setInviteUserId(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={handleSendInvite}
                          disabled={actionLoading === "inviting"}
                        >
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowInviteInput(false);
                            setInviteUserId("");
                            setInviteError("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      {inviteError && (
                        <p className="text-xs text-red-500">{inviteError}</p>
                      )}
                    </div>
                  )}

                  {/* Invitation list */}
                  {invitations.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                        Invitations & Requests
                      </h4>
                      {invitations.map((inv: any) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="text-foreground">{inv.userId}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {inv.type === "CREATOR_INVITE"
                                ? "Invited"
                                : "Requested"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {inv.status === "PENDING" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-green-500"
                                  onClick={() => handleRespond(inv.id, true)}
                                  disabled={
                                    actionLoading === "accepting" ||
                                    actionLoading === "rejecting"
                                  }
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-red-500"
                                  onClick={() => handleRespond(inv.id, false)}
                                  disabled={
                                    actionLoading === "accepting" ||
                                    actionLoading === "rejecting"
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {inv.status === "ACCEPTED" && (
                              <Badge
                                variant="outline"
                                className="text-green-500 border-green-500/30 text-[10px]"
                              >
                                Accepted
                              </Badge>
                            )}
                            {inv.status === "REJECTED" && (
                              <Badge
                                variant="outline"
                                className="text-red-500 border-red-500/30 text-[10px]"
                              >
                                Rejected
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Save / Share */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  variant={saved ? "default" : "outline"}
                  className="flex-1"
                >
                  <Heart
                    className={`mr-1.5 h-4 w-4 ${saved ? "fill-current" : ""}`}
                  />
                  {saved ? "Saved" : "Save"}
                </Button>
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="flex-1"
                >
                  <Share2 className="mr-1.5 h-4 w-4" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Similar Events */}
      {similarEvents.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">
            Similar Events in {event.category.replace(/_/g, " ")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {similarEvents.slice(0, 3).map((e, idx) => (
              <EventCard
                key={e.id}
                event={e}
                position={idx + 1}
                sourceList="similar_events"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
