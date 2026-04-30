'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    api.get('/groups')
      .then((res) => setGroups(res.data.data || []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Groups</h1>
          <p className="text-muted-foreground">Find groups that share your interests</p>
        </div>
        {isAuthenticated && (
          <Button asChild>
            <Link href="/groups/new">Create Group</Link>
          </Button>
        )}
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
          {groups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`}>
              <Card className="p-6 transition-colors hover:bg-muted/50">
                <h3 className="font-semibold">{group.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {group.description || 'No description'}
                </p>
                {group.interests?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {group.interests.slice(0, 3).map((interest: string) => (
                      <span key={interest} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {interest}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg text-muted-foreground">No groups yet.</p>
          {isAuthenticated ? (
            <Link href="/groups/new" className="mt-2 inline-block text-sm font-medium text-primary underline">
              Create the first group
            </Link>
          ) : (
            <Link href="/login" className="mt-2 inline-block text-sm font-medium text-primary underline">
              Sign in to create a group
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
