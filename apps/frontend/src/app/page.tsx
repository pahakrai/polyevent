"use client";

import { useEffect, useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { EventCard } from "@/components/EventCard";
import { useAnalytics } from "@/hooks/useAnalytics";
import { getAllEvents } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";

export default function HomePage() {
  const { trackPageView } = useAnalytics();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  useEffect(() => {
    getAllEvents(1, 12)
      .then((res) => setEvents(res.data || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const handleLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.location.href = `/search?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&radiusKm=20`;
        },
        () => {
          window.location.href = "/search";
        },
      );
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent text-primary-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/30 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Find Live Music Events Near You
          </h1>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Discover concerts, jam sessions, workshops, and more
          </p>
          <div className="mt-8 flex justify-center">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-4 text-xl font-semibold">Browse by Category</h2>
        <CategoryFilter />
      </section>

      {/* Upcoming Events */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Upcoming Events</h2>
          <a
            href="/search"
            className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all &rarr;
          </a>
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
                sourceList="home_trending"
              />
            ))}
            {events.length === 0 && (
              <p className="col-span-full py-12 text-center text-muted-foreground">
                No events yet. Check back soon!
              </p>
            )}
          </div>
        )}
      </section>

      {/* Location prompt */}
      <section className="mx-auto max-w-6xl px-4 py-10 text-center">
        <Card className="p-8">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold">Find Events Near You</h2>
            <p className="text-muted-foreground">
              Allow location access to see events in your area
            </p>
            <Button onClick={handleLocation} variant="accent" size="lg">
              <MapPin className="mr-2 h-4 w-4" />
              Use My Location
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
