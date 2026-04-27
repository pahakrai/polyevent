"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EventCard } from "@/components/EventCard";
import { useAnalytics } from "@/hooks/useAnalytics";
import { searchEvents } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SearchContent() {
  const searchParams = useSearchParams();
  const { trackPageView, trackSearchEvent } = useAnalytics();

  const query = searchParams.get("query") || "";
  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");
  const radiusKm = parseInt(searchParams.get("radiusKm") || "20");
  const category = searchParams.get("category") || "";

  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  useEffect(() => {
    setLoading(true);
    const params: any = { page: 1, limit: 20 };
    if (query) params.query = query;
    if (category) params.categories = [category];
    if (!isNaN(lat)) {
      params.lat = lat;
      params.lon = lon;
      params.radiusKm = radiusKm;
    }

    searchEvents(params)
      .then((res) => {
        setEvents(res.data || []);
        setTotal(res.total || 0);
        if (query) {
          trackSearchEvent({
            query,
            filters: {
              categories: category ? [category] : undefined,
              lat: !isNaN(lat) ? lat : undefined,
              lon: !isNaN(lon) ? lon : undefined,
              radiusKm: !isNaN(lat) ? radiusKm : undefined,
            },
            resultCount: res.total || 0,
          });
        }
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [query, lat, lon, radiusKm, category, trackSearchEvent]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {query
            ? `Search: "${query}"`
            : category
              ? `Category: ${category}`
              : "All Events"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {total} event{total !== 1 ? "s" : ""} found
          {!isNaN(lat) && ` within ${radiusKm}km`}
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
              sourceList="search_results"
            />
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg text-muted-foreground">
            No events found matching your search.
          </p>
          <p className="mt-1 text-muted-foreground/70">
            Try different keywords or filters.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-muted-foreground">
          Loading search...
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
