'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/groups/${groupId}`)
      .then((res) => setGroup(res.data))
      .catch(() => setGroup(null))
      .finally(() => setLoading(false));
  }, [groupId]);

  const handleJoin = async () => {
    await api.post(`/groups/${groupId}/join`);
    const { data } = await api.get(`/groups/${groupId}`);
    setGroup(data);
  };

  const handleLeave = async () => {
    await api.post(`/groups/${groupId}/leave`);
    const { data } = await api.get(`/groups/${groupId}`);
    setGroup(data);
  };

  if (loading) return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  if (!group) return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <p className="text-lg text-muted-foreground">Group not found.</p>
      <Link href="/groups" className="text-sm text-primary underline">Back to groups</Link>
    </div>
  );

  const isMember = group.members?.some((m: any) => m.userId === user?.id);
  const isOwner = group.ownerId === user?.id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/groups" className="mb-4 inline-block text-sm text-muted-foreground hover:underline">&larr; All Groups</Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <p className="mt-2 text-muted-foreground">{group.description || 'No description'}</p>

            {group.interests?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {group.interests.map((i: string) => (
                  <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{i}</span>
                ))}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              {isAuthenticated && !isMember && (
                <Button onClick={handleJoin}>Join Group</Button>
              )}
              {isMember && !isOwner && (
                <Button variant="outline" onClick={handleLeave}>Leave Group</Button>
              )}
              {isMember && (
                <Link
                  href={`/groups/${groupId}/vendors`}
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Find Vendors
                </Link>
              )}
              {isOwner && (
                <Link
                  href={`/groups/${groupId}/vendors`}
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Browse Vendors for Group
                </Link>
              )}
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6">
            <h2 className="mb-3 font-semibold">Members ({group.members?.length || 0})</h2>
            <div className="space-y-2">
              {group.members?.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                    {(m.userId || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">User {m.userId?.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
