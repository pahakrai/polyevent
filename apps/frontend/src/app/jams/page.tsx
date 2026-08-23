"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { findJamSessions, sessionWanted, type JamSession } from "@/lib/api";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function JamsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { trackPageView } = useAnalytics();
  const [jams, setJams] = useState<JamSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  useEffect(() => {
    setLoading(true);
    findJamSessions({ limit: 20 })
      .then((res) => {
        setJams(res.data || []);
        setTotal(res.total || 0);
      })
      .catch(() => setJams([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sessions & Meetups</h1>
          <p className="mt-1 text-muted-foreground">
            {total} open session{total !== 1 ? "s" : ""} looking for participants
          </p>
        </div>
        {isAuthenticated && (
          <Link
            href="/jams/new"
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Host a Session
          </Link>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="space-y-3 p-6">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jams.map((jam) => {
            const startDate = new Date(jam.startTime);
            const loc = jam.location || {};
            return (
              <Link key={jam.id} href={`/jams/${jam.id}`}>
                <Card className="p-6 transition-colors hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug">{jam.title}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {startDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="mt-3">
                    {sessionWanted(jam).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sessionWanted(jam).slice(0, 4).map((inst) => (
                          <Badge key={inst} variant="accent" className="text-[10px]">
                            {inst.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {loc.city || loc.venueName || "Location TBD"}
                  </p>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {jam.rsvpCount || 0} / {jam.maxAttendees || "∞"} joined
                    </span>
                    {jam.tags?.length > 0 && (
                      <div className="flex gap-1">
                        {jam.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {tag.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && jams.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg text-muted-foreground">No sessions yet.</p>
          {isAuthenticated ? (
            <Link href="/jams/new" className="mt-2 inline-block text-sm font-medium text-primary underline">
              Host the first session
            </Link>
          ) : (
            <Link href="/login" className="mt-2 inline-block text-sm font-medium text-primary underline">
              Sign in to host a session
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
