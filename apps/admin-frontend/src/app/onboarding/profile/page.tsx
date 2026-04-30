'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useAdminAuthStore } from '@/stores/admin-auth-store';
import { api } from '@/lib/api';

const CATEGORIES = [
  { value: 'MUSIC', label: 'Music' },
  { value: 'ART', label: 'Art' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'ACTIVITIES', label: 'Activities' },
  { value: 'OTHER', label: 'Other' },
];

export default function OnboardingProfile() {
  const router = useRouter();
  const { setStep, setVendorId } = useOnboardingStore();
  const user = useAdminAuthStore((s) => s.user);
  const [form, setForm] = useState({
    businessName: '',
    description: '',
    category: 'MUSIC',
    contactEmail: '',
    contactPhone: '',
    website: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/vendors', {
        userId: user?.id,
        businessName: form.businessName,
        description: form.description,
        category: form.category,
        contactEmail: form.contactEmail || user?.email,
        contactPhone: form.contactPhone,
        website: form.website,
        address: {},
        location: {},
      });
      setVendorId(data.id);
      setStep(2);
      router.push('/onboarding/venues');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create vendor profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-1 text-xl font-semibold">Create your business profile</h2>
      <p className="mb-6 text-sm text-muted-foreground">Tell us about your business so users can find you.</p>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Business Name *</label>
          <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">Category *</label>
          <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Contact Email *</label>
            <input type="email" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required />
          </div>
          <div>
            <label className="text-sm font-medium">Contact Phone *</label>
            <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} required />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Website</label>
          <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {loading ? 'Saving...' : 'Continue to Venues'}
        </button>
      </form>
    </div>
  );
}
