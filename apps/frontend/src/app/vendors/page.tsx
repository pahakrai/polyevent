'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'MUSIC', label: 'Music' },
  { value: 'ART', label: 'Art' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'ACTIVITIES', label: 'Activities' },
  { value: 'OTHER', label: 'Other' },
];

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = category ? `?category=${category}` : '';
    api.get(`/vendors${params}`)
      .then((res) => setVendors(res.data.data || []))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Discover Vendors</h1>
      <p className="mb-6 text-muted-foreground">Find venues and spaces for your next activity</p>

      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`rounded-full px-4 py-1.5 text-sm ${category === c.value ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`}
          >
            {c.label}
          </button>
        ))}
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
          {vendors.map((vendor) => (
            <Link key={vendor.id} href={`/vendors/${vendor.id}`}>
              <Card className="p-6 transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-lg font-bold">
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
                <div className="mt-2 flex items-center gap-1 text-sm">
                  <span className="text-yellow-500">&#9733;</span>
                  <span>{vendor.rating?.toFixed(1) || 'N/A'}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {vendor.verificationStatus === 'VERIFIED' && '(Verified)'}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && vendors.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          No vendors found{category ? ` in ${category}` : ''}.
        </div>
      )}
    </div>
  );
}
