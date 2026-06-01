"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { discoverForYou, suggestGroups, type MusicianProfile, type GroupData } from "@/lib/api";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MusicianProfileForm } from "@/components/MusicianProfileForm";

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  LOOKING_TO_JOIN: { label: "Looking to join", color: "bg-green-100 text-green-800" },
  LOOKING_FOR_MEMBERS: { label: "Looking for members", color: "bg-blue-100 text-blue-800" },
  OPEN_TO_JAM: { label: "Open to jam", color: "bg-amber-100 text-amber-800" },
  JUST_BROWSING: { label: "Browsing", color: "bg-muted text-muted-foreground" },
};

export default function DiscoverPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { trackPageView } = useAnalytics();
  const [musicians, setMusicians] = useState<MusicianProfile[]>([]);
  const [totalMusicians, setTotalMusicians] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [groups, setGroups] = useState<(GroupData & { matchScore: number })[]>([]);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([discoverForYou(), suggestGroups()])
      .then(([res, g]) => {
        setMusicians(res.musicians || []);
        setTotalMusicians(res.totalMusicians || 0);
        setGroups(g.data || []);
      })
      .catch(() => setMusicians([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold">Discover</h1>
        <p className="mt-4 text-muted-foreground">
          Sign in to get personalized musician matches and recommendations.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <MusicianProfileForm onComplete={() => setShowOnboarding(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">For You</h1>
          <p className="mt-1 text-muted-foreground">
            {totalMusicians > 0
              ? `${totalMusicians} musician matches based on your profile`
              : "Personalized recommendations"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowOnboarding(true)}>
          Edit Profile
        </Button>
      </div>

      {loading ? (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Musicians for you</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="space-y-3 p-6">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
          {musicians.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">Musicians for you</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {musicians.map((profile) => {
                  const intentCfg = INTENT_LABELS[profile.intent] || INTENT_LABELS.JUST_BROWSING;
                  return (
                    <Link key={profile.id} href={`/musicians/${profile.userId}`}>
                      <Card className="p-6 transition-colors hover:bg-muted/50">
                        <div className="flex items-start justify-between">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${intentCfg.color}`}>
                            {intentCfg.label}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {profile.skillLevel.toLowerCase()}
                          </span>
                        </div>

                        {profile.instruments?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {profile.instruments.slice(0, 4).map((inst) => (
                              <Badge key={inst} variant="accent" className="text-[10px]">
                                {inst.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        )}

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
                            Wants: {profile.lookingFor.map((i) => i.replace(/_/g, " ")).join(", ")}
                          </p>
                        )}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {musicians.length === 0 && (
            <div className="rounded-lg border bg-card p-12 text-center">
              <h3 className="text-lg font-semibold">No matches yet</h3>
              <p className="mt-2 text-muted-foreground">
                Complete your musician profile so we can find people who match your interests.
              </p>
              <Button className="mt-4" onClick={() => setShowOnboarding(true)}>
                Set Up Profile
              </Button>
            </div>
          )}


          {groups.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">Suggested Groups</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {groups.map((g) => (
                  <Link key={g.id} href={`/groups/${g.id}`}>
                    <Card className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                      <div>
                        <h4 className="font-medium text-sm">{g.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {g.memberCount || 0} members
                          {g.interests?.length > 0 && ` · ${g.interests.slice(0, 2).join(", ")}`}
                        </p>
                      </div>
                      <Badge variant="accent" className="text-[10px]">
                        {g.matchScore}% match
                      </Badge>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10 text-center">
            <Link href="/musicians" className="text-sm font-medium text-primary hover:underline">
              Browse all musicians →
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
