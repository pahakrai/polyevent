"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getEventTypes, type EventTypeDefinition } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_ORDER = ["MUSIC", "ART", "SPORTS", "ACTIVITIES", "OTHER"];

const CATEGORY_LABELS: Record<string, string> = {
  MUSIC: "Music",
  ART: "Art",
  SPORTS: "Sports",
  ACTIVITIES: "Activities",
  OTHER: "Other",
};

export default function TypesPage() {
  const [types, setTypes] = useState<EventTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEventTypes()
      .then((data) => setTypes(data))
      .catch(() => setTypes([]))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, EventTypeDefinition[]>();
    for (const t of types) {
      const key = t.category || "OTHER";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
    );
  }, [types]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Explore Event Types</h1>
        <p className="mt-1 text-muted-foreground">
          From jam sessions to art classes, pickup games to board game nights — find
          your kind of gathering.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-4 text-lg font-semibold">
                {CATEGORY_LABELS[category] || category}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((t) => (
                  <Link key={t.id} href={`/events?type=${encodeURIComponent(t.slug)}`}>
                    <Card className="h-full transition-colors hover:bg-muted/50">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-medium">{t.name}</h3>
                            {t.description && (
                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {t.description}
                              </p>
                            )}
                          </div>
                          {t.allowRsvp && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              RSVP
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {grouped.length === 0 && (
            <div className="rounded-lg border bg-card p-12 text-center">
              <p className="text-muted-foreground">No event types configured yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
