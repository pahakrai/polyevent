"use client";

import Link from "next/link";
import { Heart, MapPin, Clock, DollarSign } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string;
    category: string;
    tags?: string[];
    startTime: string;
    location?: any;
    price?: any;
    currentBookings?: number;
    maxAttendees?: number;
    images?: string[];
  };
  position?: number;
  sourceList?: string;
}

export function EventCard({
  event,
  position,
  sourceList = "browse",
}: EventCardProps) {
  const { trackClick, trackEventSave } = useAnalytics();

  const startDate = new Date(event.startTime);
  const loc = event.location || {};
  const price = event.price || {};

  const priceText =
    price.price != null
      ? `$${price.price}`
      : price.minPrice != null
        ? `$${price.minPrice} – $${price.maxPrice}`
        : "Free";

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <Link
        href={`/events/${event.id}`}
        onClick={() => {
          if (position !== undefined) {
            trackClick(event.id, position, sourceList);
          }
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Badge variant="accent" className="mb-2 text-[10px] uppercase tracking-wider">
                {event.category.replace(/_/g, " ")}
              </Badge>
              <h3 className="h3 text-base leading-snug group-hover:text-primary transition-colors">
                {event.title}
              </h3>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              <Clock className="mr-1 inline h-3 w-3" />
              {startDate.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {event.description}
          </p>

          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {event.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {loc.city || loc.venueName || "Location TBD"}
            </span>
            <span className="flex items-center gap-1 font-medium text-foreground">
              <DollarSign className="h-3 w-3" />
              {priceText}
            </span>
          </div>

          {event.maxAttendees && (
            <div className="w-full rounded-full bg-muted h-1.5">
              <div
                className="h-1.5 rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(
                    ((event.currentBookings || 0) / event.maxAttendees) * 100,
                    100,
                  )}%`,
                }}
              />
            </div>
          )}
        </CardContent>
      </Link>

      <CardContent>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            trackEventSave(event.id, event.category);
          }}
          className="text-muted-foreground hover:text-primary"
          aria-label="Save event"
        >
          <Heart className="mr-1.5 h-4 w-4" />
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
