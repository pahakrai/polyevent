'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createEvent } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = ['MUSIC', 'ART', 'SPORTS', 'ACTIVITIES', 'OTHER'];

const INTEREST_TAGS = [
  'beginner', 'intermediate', 'advanced',
  'acoustic', 'electric', 'classical', 'jazz', 'rock', 'hip-hop',
  'painting', 'sculpture', 'photography', 'digital',
  'yoga', 'hiking', 'basketball', 'soccer', 'tennis',
  'outdoor', 'indoor', 'family-friendly', 'adults-only',
];

interface FormData {
  title: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  locationName: string;
  address: string;
  city: string;
  country: string;
  priceType: 'free' | 'fixed' | 'range';
  priceAmount: string;
  priceMin: string;
  priceMax: string;
  currency: string;
  maxAttendees: string;
  tags: string[];
  ageRestriction: string;
  groupId: string;
}

function NewEventForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    category: '',
    startTime: '',
    endTime: '',
    locationName: '',
    address: '',
    city: '',
    country: '',
    priceType: 'free',
    priceAmount: '',
    priceMin: '',
    priceMax: '',
    currency: 'USD',
    maxAttendees: '',
    tags: [],
    ageRestriction: '',
    groupId: searchParams.get('groupId') || '',
  });

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Sign in required</h1>
        <p className="mt-2 text-muted-foreground">
          You need to sign in to create events.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const update = (field: keyof FormData, value: string | string[]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title || !form.description || !form.category) {
      setError('Title, description, and category are required.');
      return;
    }
    if (!form.startTime || !form.endTime) {
      setError('Start and end times are required.');
      return;
    }
    if (new Date(form.endTime) <= new Date(form.startTime)) {
      setError('End time must be after start time.');
      return;
    }

    const price: Record<string, any> = { currency: form.currency };
    if (form.priceType === 'fixed' && form.priceAmount) {
      price.price = parseFloat(form.priceAmount);
    } else if (form.priceType === 'range') {
      if (form.priceMin) price.minPrice = parseFloat(form.priceMin);
      if (form.priceMax) price.maxPrice = parseFloat(form.priceMax);
    } else {
      price.price = 0;
    }

    setSubmitting(true);
    try {
      const res = await createEvent({
        title: form.title,
        description: form.description,
        category: form.category,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        location: {
          venueName: form.locationName || undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          country: form.country || undefined,
        },
        price,
        maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees) : undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
        ageRestriction: form.ageRestriction ? parseInt(form.ageRestriction) : undefined,
        groupId: form.groupId || undefined,
      });

      router.push(`/events/${res.id || res.data?.id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create event.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';
  const labelClass = 'mb-1.5 block text-sm font-medium';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/events"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Events
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Create Event</h1>
        <p className="text-muted-foreground">
          Fill in the details to publish your event
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* Basic info */}
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Basic Information</h2>

          <div>
            <label className={labelClass}>Title *</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. Saturday Morning Jam Session"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              maxLength={200}
            />
          </div>

          <div>
            <label className={labelClass}>Description *</label>
            <textarea
              className={inputClass}
              rows={5}
              placeholder="Describe what the event is about, what to bring, what to expect..."
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              maxLength={5000}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {form.description.length}/5000
            </p>
          </div>

          <div>
            <label className={labelClass}>Category *</label>
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Schedule */}
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Schedule</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Start Time *</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={form.startTime}
                onChange={(e) => update('startTime', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>End Time *</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={form.endTime}
                onChange={(e) => update('endTime', e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Location */}
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Location</h2>

          <div>
            <label className={labelClass}>Venue / Place Name</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. Central Music Studio"
              value={form.locationName}
              onChange={(e) => update('locationName', e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Address</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Street address"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>City</label>
              <input
                type="text"
                className={inputClass}
                placeholder="City"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input
                type="text"
                className={inputClass}
                placeholder="Country"
                value={form.country}
                onChange={(e) => update('country', e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Pricing */}
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Pricing</h2>

          <div className="flex gap-3">
            {(['free', 'fixed', 'range'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => update('priceType', type)}
              >
                <Badge
                  variant={form.priceType === type ? 'default' : 'secondary'}
                  className="cursor-pointer px-3 py-1.5 text-sm"
                >
                  {type === 'free' ? 'Free' : type === 'fixed' ? 'Fixed Price' : 'Price Range'}
                </Badge>
              </button>
            ))}
          </div>

          {form.priceType === 'fixed' && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className={labelClass}>Price</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={form.priceAmount}
                  onChange={(e) => update('priceAmount', e.target.value)}
                />
              </div>
              <div className="w-24">
                <label className={labelClass}>Currency</label>
                <select
                  className={inputClass}
                  value={form.currency}
                  onChange={(e) => update('currency', e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>
            </div>
          )}

          {form.priceType === 'range' && (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className={labelClass}>Min Price</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={form.priceMin}
                  onChange={(e) => update('priceMin', e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className={labelClass}>Max Price</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={form.priceMax}
                  onChange={(e) => update('priceMax', e.target.value)}
                />
              </div>
              <div className="w-24">
                <label className={labelClass}>Currency</label>
                <select
                  className={inputClass}
                  value={form.currency}
                  onChange={(e) => update('currency', e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>
            </div>
          )}
        </Card>

        {/* Additional settings */}
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Additional Settings</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Max Attendees</label>
              <input
                type="number"
                className={inputClass}
                placeholder="No limit"
                min="1"
                value={form.maxAttendees}
                onChange={(e) => update('maxAttendees', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Age Restriction</label>
              <input
                type="number"
                className={inputClass}
                placeholder="e.g. 18"
                min="0"
                value={form.ageRestriction}
                onChange={(e) => update('ageRestriction', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Group (optional)</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Group ID"
              value={form.groupId}
              onChange={(e) => update('groupId', e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Associate this event with a group. Find the group ID from your
              group&apos;s page URL.
            </p>
          </div>
        </Card>

        {/* Tags */}
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Tags</h2>
          <p className="text-sm text-muted-foreground">
            Select tags to help people discover your event
          </p>
          <div className="flex flex-wrap gap-2">
            {INTEREST_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                <Badge
                  variant={form.tags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                >
                  {tag}
                </Badge>
              </button>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/events"
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Cancel
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Event'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense fallback={null}>
      <NewEventForm />
    </Suspense>
  );
}
