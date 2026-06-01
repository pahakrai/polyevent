"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { getGroup, listGroupPosts, findJamSessions, type GroupData, type GroupPost, type JamSession } from "@/lib/api";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GroupPostComposer } from "@/components/GroupPostComposer";
import { GroupPostCard } from "@/components/GroupPostCard";
import { GroupChat } from "@/components/GroupChat";

type Tab = "feed" | "jams" | "members" | "chat";

export default function GroupHubPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { trackPageView } = useAnalytics();
  const [tab, setTab] = useState<Tab>("feed");
  const [group, setGroup] = useState<GroupData | null>(null);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [jams, setJams] = useState<JamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsTotal, setPostsTotal] = useState(0);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    Promise.all([
      getGroup(groupId),
      listGroupPosts(groupId),
      findJamSessions({ groupId, limit: 20 }),
    ])
      .then(([g, p, j]) => {
        setGroup(g);
        setPosts(p.data || []);
        setPostsTotal(p.total || 0);
        setJams(j.data || []);
      })
      .catch(() => setGroup(null))
      .finally(() => setLoading(false));
  }, [groupId]);

  const refreshPosts = async () => {
    const p = await listGroupPosts(groupId);
    setPosts(p.data || []);
    setPostsTotal(p.total || 0);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-4 w-1/2 mb-6" />
        <Card className="p-6 space-y-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-20 w-full" />
        </Card>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Group not found</h1>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "feed", label: "Feed" },
    { key: "jams", label: `Jams (${jams.length})` },
    { key: "members", label: "Members" },
    { key: "chat", label: "Chat" },
  ];

  const isMember = group.members?.some((m: any) => {
    const uid = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    return m.userId === uid;
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.isPrivate && (
            <Badge variant="outline" className="text-xs">Private</Badge>
          )}
        </div>
        <p className="mt-1 text-muted-foreground">
          {group.description || "No description"} · {group.memberCount || 0} members
        </p>
        {group.interests?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {group.interests.map((i) => (
              <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
            ))}
          </div>
        )}
        {isAuthenticated && !isMember && (
          <Button className="mt-3" size="sm" variant="accent">
            Join Group
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "feed" && (
        <div className="space-y-4">
          {isAuthenticated && isMember && (
            <GroupPostComposer groupId={groupId} onPostCreated={refreshPosts} />
          )}
          {posts.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No posts yet.</p>
          ) : (
            posts.map((post) => (
              <GroupPostCard key={post.id} post={post} />
            ))
          )}
        </div>
      )}

      {tab === "jams" && (
        <div>
          {isAuthenticated && isMember && (
            <Link
              href={`/jams/new?groupId=${groupId}`}
              className="mb-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Propose a Jam
            </Link>
          )}
          {jams.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No jam sessions in this group.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {jams.map((jam) => {
                const d = new Date(jam.startTime);
                return (
                  <Link key={jam.id} href={`/jams/${jam.id}`}>
                    <Card className="p-4 transition-colors hover:bg-muted/50">
                      <div className="flex justify-between">
                        <div>
                          <h4 className="font-medium">{jam.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {d.toLocaleDateString()} · {jam.rsvpCount}/{jam.maxAttendees || "∞"} joined
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {jam.instrumentsWanted?.slice(0, 3).map((inst) => (
                            <Badge key={inst} variant="accent" className="text-[10px]">
                              {inst.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "members" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {(group.members || []).map((m: any) => (
            <Card key={m.id} className="flex items-center gap-2 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {m.userId?.slice(0, 2).toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-sm font-medium truncate">{m.userId?.slice(0, 8)}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{m.role}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "chat" && (
        <GroupChat groupId={groupId} />
      )}
    </div>
  );
}
