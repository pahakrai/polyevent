'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function GroupVendorsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/vendors')
      .then((res) => setVendors(res.data.data || []))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`/groups/${groupId}`} className="mb-4 inline-block text-sm text-muted-foreground hover:underline">
        &larr; Back to group
      </Link>

      <h1 className="mb-2 text-2xl font-bold">Select a Vendor</h1>
      <p className="mb-6 text-muted-foreground">Browse vendors to find the right venue for your group activity</p>

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
          {vendors.map((vendor) => (
            <Link key={vendor.id} href={`/vendors/${vendor.id}`}>
              <Card className="p-6 transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-bold">
                    {vendor.businessName?.[0] || 'V'}
                  </div>
                  <div>
                    <h3 className="font-semibold">{vendor.businessName}</h3>
                    <p className="text-xs text-muted-foreground">{vendor.category}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                  {vendor.description || 'No description'}
                </p>
                <p className="mt-2 text-xs text-primary">View venues &rarr;</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
