"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Heart, Share2, MapPin, Clock } from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { useAnalytics } from "@/hooks/useAnalytics";
import { getEvent, getEventsByCategory } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function EventDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { trackPageView, trackEventView, trackEventSave, trackEventShare } =
    useAnalytics();

  const [event, setEvent] = useState<any>(null);
  const [similarEvents, setSimilarEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

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

        return getEventsByCategory(data.category, 1, 6);
      })
      .then((res) => {
        setSimilarEvents((res.data || []).filter((e: any) => e.id !== id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, trackEventView]);

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
        <h1 className="text-2xl font-bold text-foreground">
          Event Not Found
        </h1>
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
        <Badge variant="accent" className="mb-2 uppercase tracking-wider">
          {event.category.replace(/_/g, " ")}
        </Badge>
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

          <Card>
            <CardContent className="p-6">
              <h2 className="mb-3 text-lg font-semibold">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {event.tags?.map((tag: string) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
                {(!event.tags || event.tags.length === 0) && (
                  <span className="text-sm text-muted-foreground">
                    No tags
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          <Card className="sticky top-20">
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Location
                </h3>
                <p className="mt-1 flex items-center gap-1 text-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {loc.venueName || loc.name || "Venue TBD"}
                </p>
                {loc.address && (
                  <p className="text-sm text-muted-foreground">
                    {loc.address}
                  </p>
                )}
                {loc.city && (
                  <p className="text-sm text-muted-foreground">
                    {loc.city}
                    {loc.country ? `, ${loc.country}` : ""}
                  </p>
                )}
              </div>

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

              {event.maxAttendees && (
                <div>
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                    Availability
                  </h3>
                  <div className="mt-2 w-full rounded-full bg-muted h-2">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(
                          ((event.currentBookings || 0) /
                            event.maxAttendees) *
                            100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.currentBookings || 0} / {event.maxAttendees} booked
                  </p>
                </div>
              )}

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
