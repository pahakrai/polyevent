"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { api, rsvpToJam, cancelRsvp, getAttendees, sessionWanted, type JamSession } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function JamDetailPage() {
  const params = useParams();
  const jamId = params.id as string;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [jam, setJam] = useState<JamSession | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvping, setRsvping] = useState(false);
  const [hasRsvpd, setHasRsvpd] = useState(false);

  useEffect(() => {
    if (!jamId) return;
    setLoading(true);
    api.get(`/events/${jamId}`)
      .then((res) => {
        setJam(res.data);
        return getAttendees(jamId);
      })
      .then((att) => {
        setAttendees(att || []);
        const userId = localStorage.getItem("userId");
        if (userId) {
          setHasRsvpd((att || []).some((a: any) => a.userId === userId));
        }
      })
      .catch(() => setJam(null))
      .finally(() => setLoading(false));
  }, [jamId]);

  const handleRsvp = async () => {
    setRsvping(true);
    try {
      const { event } = await rsvpToJam(jamId);
      setJam(event);
      setHasRsvpd(true);
      const att = await getAttendees(jamId);
      setAttendees(att || []);
    } catch {
      // ignore
    } finally {
      setRsvping(false);
    }
  };

  const handleCancelRsvp = async () => {
    setRsvping(true);
    try {
      await cancelRsvp(jamId);
      setHasRsvpd(false);
      const res = await api.get(`/events/${jamId}`);
      setJam(res.data);
      const att = await getAttendees(jamId);
      setAttendees(att || []);
    } catch {
      // ignore
    } finally {
      setRsvping(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="space-y-4 p-8">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </Card>
      </div>
    );
  }

  if (!jam) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Jam session not found</h1>
      </div>
    );
  }

  const startDate = new Date(jam.startTime);
  const endDate = new Date(jam.endTime);
  const loc = jam.location || {};
  const isFull = jam.maxAttendees != null && jam.rsvpCount >= jam.maxAttendees;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card className="p-8">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="accent" className="mb-2">Jam Session</Badge>
            <h1 className="text-2xl font-bold">{jam.title}</h1>
          </div>
          {isFull && (
            <Badge variant="outline" className="border-red-200 text-red-600">Full</Badge>
          )}
        </div>

        <p className="mt-4 text-muted-foreground leading-relaxed">{jam.description}</p>

        <div className="mt-6 space-y-3 text-sm">
          <div className="flex gap-2">
            <span className="font-medium">When:</span>
            <span className="text-muted-foreground">
              {startDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              {startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              {" — "}
              {endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium">Where:</span>
            <span className="text-muted-foreground">
              {loc.venueName || loc.name || "Location TBD"}
              {loc.city ? `, ${loc.city}` : ""}
            </span>
          </div>
        </div>

        {sessionWanted(jam).length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Looking For
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {sessionWanted(jam).map((inst) => (
                <Badge key={inst} variant="accent" className="px-3 py-1 text-sm">
                  {inst.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {jam.tags?.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-1.5">
              {jam.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* RSVP */}
        <div className="mt-8">
          {isAuthenticated ? (
            hasRsvpd ? (
              <Button
                variant="outline"
                onClick={handleCancelRsvp}
                disabled={rsvping}
                className="w-full"
              >
                {rsvping ? "..." : "Cancel RSVP"}
              </Button>
            ) : (
              <Button
                onClick={handleRsvp}
                disabled={rsvping || isFull}
                className="w-full"
              >
                {rsvping ? "Joining..." : isFull ? "Session Full" : "I'm In!"}
              </Button>
            )
          ) : (
            <a
              href="/login"
              className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground"
            >
              Sign in to RSVP
            </a>
          )}

          <p className="mt-2 text-center text-sm text-muted-foreground">
            {jam.rsvpCount || 0} / {jam.maxAttendees || "∞"} musicians joined
          </p>
        </div>

        {/* Attendees */}
        {attendees.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Attendees ({attendees.length})
            </h3>
            <div className="mt-3 space-y-2">
              {attendees.map((att) => (
                <div key={att.id} className="flex items-center gap-2 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {att.userId?.slice(0, 2).toUpperCase() || "?"}
                  </div>
                  <span className="text-muted-foreground">Musician</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
