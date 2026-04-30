'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function VendorDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [vendor, setVendor] = useState<any>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: v } = await api.get(`/vendors/${vendorId}`);
        setVendor(v);
        const { data: ven } = await api.get(`/vendors/${vendorId}/venues`);
        setVenues(ven.data || []);
      } catch { setVendor(null); }
      finally { setLoading(false); }
    }
    load();
  }, [vendorId]);

  if (loading) return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );

  if (!vendor) return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <p className="text-lg text-muted-foreground">Vendor not found.</p>
      <Link href="/vendors" className="text-sm text-primary underline">Back to vendors</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/vendors" className="mb-4 inline-block text-sm text-muted-foreground hover:underline">&larr; All Vendors</Link>

      <Card className="mb-8 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-2xl font-bold">
            {vendor.businessName?.[0] || 'V'}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{vendor.businessName}</h1>
            <p className="text-sm text-muted-foreground mt-1">{vendor.category}{vendor.subCategory ? ` / ${vendor.subCategory}` : ''}</p>
            <p className="mt-2">{vendor.description}</p>
            <div className="mt-3 flex gap-4 text-sm">
              {vendor.website && <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-primary underline">Website</a>}
              <span>{vendor.contactEmail}</span>
              <span>{vendor.contactPhone}</span>
            </div>
          </div>
        </div>
      </Card>

      <h2 className="mb-4 text-xl font-bold">Venues ({venues.length})</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {venues.map((venue) => (
          <Link key={venue.id} href={`/vendors/${vendorId}/venues/${venue.id}`}>
            <Card className="p-6 transition-colors hover:bg-muted/50">
              <h3 className="font-semibold">{venue.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {venue.type} · Capacity: {venue.capacity} · {venue.pricingModel}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{venue.description}</p>
              {venue.hourlyRate && (
                <p className="mt-2 text-sm font-medium">${venue.hourlyRate}/hr</p>
              )}
              <div className="mt-2">
                <span className={`text-xs ${venue.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                  {venue.isAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      {venues.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">No venues available yet.</p>
      )}
    </div>
  );
}
