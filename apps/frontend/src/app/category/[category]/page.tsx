"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { useAnalytics } from "@/hooks/useAnalytics";
import { getEventsByCategory } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CategoryPage() {
  const params = useParams();
  const category = ((params?.category ?? "") as string).toUpperCase();
  const { trackPageView, trackCategoryBrowse } = useAnalytics();

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackPageView();
    trackCategoryBrowse(category);
  }, [category, trackPageView, trackCategoryBrowse]);

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    getEventsByCategory(category, 1, 20)
      .then((res) => setEvents(res.data || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold capitalize">
          {category.replace(/_/g, " ").toLowerCase()}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="space-y-3 p-6">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event, idx) => (
            <EventCard
              key={event.id}
              event={event}
              position={idx + 1}
              sourceList="category_browse"
            />
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg text-muted-foreground">
            No events in this category yet.
          </p>
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Browse all events &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
