"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browseMusicians, type MusicianProfile } from "@/lib/api";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  LOOKING_TO_JOIN: { label: "Looking to join", color: "bg-green-100 text-green-800" },
  LOOKING_FOR_MEMBERS: { label: "Looking for members", color: "bg-blue-100 text-blue-800" },
  OPEN_TO_JAM: { label: "Open to jam", color: "bg-amber-100 text-amber-800" },
  JUST_BROWSING: { label: "Browsing", color: "bg-muted text-muted-foreground" },
};

const SKILL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  PROFESSIONAL: "Professional",
};

export default function MusiciansPage() {
  const { trackPageView } = useAnalytics();
  const [profiles, setProfiles] = useState<MusicianProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  useEffect(() => {
    setLoading(true);
    browseMusicians({ limit: 20 })
      .then((res) => {
        setProfiles(res.data || []);
        setTotal(res.total || 0);
      })
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">People Near You</h1>
        <p className="mt-1 text-muted-foreground">
          {total} {total === 1 ? "person" : "people"} looking to connect
        </p>
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
          {profiles.map((profile) => {
            const intentCfg = INTENT_LABELS[profile.intent] || INTENT_LABELS.JUST_BROWSING;
            return (
              <Link key={profile.id} href={`/musicians/${profile.userId}`}>
                <Card className="p-6 transition-colors hover:bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${intentCfg.color}`}>
                          {intentCfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {SKILL_LABELS[profile.skillLevel] || profile.skillLevel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    {profile.instruments?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {profile.instruments.slice(0, 4).map((inst) => (
                          <Badge key={inst} variant="accent" className="text-[10px]">
                            {inst.replace(/_/g, " ")}
                          </Badge>
                        ))}
                        {profile.instruments.length > 4 && (
                          <span className="text-xs text-muted-foreground">
                            +{profile.instruments.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {profile.genres?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {profile.genres.slice(0, 3).map((g) => (
                        <Badge key={g} variant="outline" className="text-[10px]">
                          {g.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {profile.lookingFor?.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Looking for: {profile.lookingFor.map((i) => i.replace(/_/g, " ")).join(", ")}
                    </p>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && profiles.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg text-muted-foreground">No people found yet.</p>
        </div>
      )}
    </div>
  );
}
