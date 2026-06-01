"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getMusicianProfile, type MusicianProfile } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  LOOKING_TO_JOIN: { label: "Looking to join a band/group", color: "bg-green-100 text-green-800" },
  LOOKING_FOR_MEMBERS: { label: "Looking for band members", color: "bg-blue-100 text-blue-800" },
  OPEN_TO_JAM: { label: "Open to jam sessions", color: "bg-amber-100 text-amber-800" },
  JUST_BROWSING: { label: "Just browsing", color: "bg-muted text-muted-foreground" },
};

const SKILL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  PROFESSIONAL: "Professional",
};

const DAY_LABELS: Record<string, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu",
  FRI: "Fri", SAT: "Sat", SUN: "Sun",
};

export default function MusicianProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const [profile, setProfile] = useState<MusicianProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getMusicianProfile(userId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId]);

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

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Profile not found</h1>
        <p className="mt-2 text-muted-foreground">
          This musician hasn't set up their profile yet.
        </p>
      </div>
    );
  }

  const intentCfg = INTENT_LABELS[profile.intent] || INTENT_LABELS.JUST_BROWSING;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card className="p-8">
        {/* Intent badge */}
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${intentCfg.color}`}>
          {intentCfg.label}
        </span>

        {/* Instruments */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Instruments
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.instruments?.map((inst) => (
              <Badge key={inst} variant="accent" className="px-3 py-1 text-sm">
                {inst.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        </div>

        {/* Skill level */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Skill Level
          </h3>
          <p className="mt-1 text-lg">{SKILL_LABELS[profile.skillLevel] || profile.skillLevel}</p>
        </div>

        {/* Genres */}
        {profile.genres?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Genres
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.genres.map((g) => (
                <Badge key={g} variant="outline" className="px-2 py-0.5 text-sm">
                  {g.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Looking for */}
        {profile.lookingFor?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Looking For
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.lookingFor.map((inst) => (
                <Badge key={inst} variant="accent" className="px-3 py-1 text-sm">
                  {inst.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Available days */}
        {profile.availableDays?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Available
            </h3>
            <div className="mt-2 flex gap-1.5">
              {profile.availableDays.map((d) => (
                <span
                  key={d}
                  className="rounded-md bg-muted px-2 py-1 text-xs font-medium"
                >
                  {DAY_LABELS[d] || d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              About
            </h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Influences */}
        {profile.influences?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Influences
            </h3>
            <p className="mt-1 text-muted-foreground">{profile.influences.join(", ")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
