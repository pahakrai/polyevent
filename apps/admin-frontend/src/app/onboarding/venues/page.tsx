'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { api } from '@/lib/api';

const VENUE_TYPES = [
  { value: 'INDOOR', label: 'Indoor' },
  { value: 'OUTDOOR', label: 'Outdoor' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'GALLERY', label: 'Gallery' },
  { value: 'FIELD', label: 'Field' },
  { value: 'COURT', label: 'Court' },
  { value: 'OTHER', label: 'Other' },
];

const PRICING_MODELS = [
  { value: 'FREE', label: 'Free' },
  { value: 'PER_HOUR', label: 'Per Hour' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'MIXED', label: 'Mixed' },
];

export default function OnboardingVenues() {
  const router = useRouter();
  const { vendorId, setStep } = useOnboardingStore();
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'INDOOR',
    capacity: 20,
    pricingModel: 'PER_HOUR',
    hourlyRate: '',
    address: '{}',
    location: '{"latitude":0,"longitude":0}',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post(`/vendors/${vendorId}/venues`, {
        vendorId,
        name: form.name,
        description: form.description,
        type: form.type,
        capacity: Number(form.capacity),
        pricingModel: form.pricingModel,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        address: JSON.parse(form.address),
        location: JSON.parse(form.location),
      });
      setStep(3);
      router.push('/onboarding/timeslots');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create venue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-1 text-xl font-semibold">Add your first venue</h2>
      <p className="mb-6 text-sm text-muted-foreground">Venues are the spaces users can book time at. You can add more later.</p>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Venue Name *</label>
          <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Type *</label>
            <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {VENUE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Capacity *</label>
            <input type="number" min={1} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Pricing Model *</label>
            <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.pricingModel} onChange={(e) => setForm({ ...form, pricingModel: e.target.value })}>
              {PRICING_MODELS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Hourly Rate ($)</label>
            <input type="number" min={0} step="0.01" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => { setStep(1); router.push('/onboarding/profile'); }} className="rounded-md border px-4 py-2 text-sm">
            Back
          </button>
          <button type="submit" disabled={loading} className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? 'Saving...' : 'Continue to Time Slots'}
          </button>
        </div>
      </form>
    </div>
  );
}
