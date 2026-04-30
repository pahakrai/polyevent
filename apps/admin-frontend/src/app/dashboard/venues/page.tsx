'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function VenuesPage() {
  const [venues, setVenues] = useState<any[]>([]);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'INDOOR', capacity: 20, pricingModel: 'PER_HOUR', hourlyRate: '' });

  const loadData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const { data: v } = await api.get(`/vendors/user/${payload.sub}`);
      setVendor(v);
      if (v?.id) {
        const { data } = await api.get(`/vendors/${v.id}/venues`);
        setVenues(data.data || []);
      }
    } catch { /* vendor may not exist */ } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/vendors/${vendor.id}/venues`, {
      vendorId: vendor.id,
      ...form,
      capacity: Number(form.capacity),
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
      address: {},
      location: { latitude: 0, longitude: 0 },
    });
    setShowAdd(false);
    setForm({ name: '', description: '', type: 'INDOOR', capacity: 20, pricingModel: 'PER_HOUR', hourlyRate: '' });
    loadData();
  };

  if (loading) return <div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-muted" />)}</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Venues</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {showAdd ? 'Cancel' : 'Add Venue'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-6 rounded-lg border bg-card p-4 space-y-3">
          <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Venue name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <select className="rounded-md border px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {['INDOOR','OUTDOOR','STUDIO','GALLERY','FIELD','COURT','OTHER'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" className="rounded-md border px-3 py-2 text-sm" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="rounded-md border px-3 py-2 text-sm" value={form.pricingModel} onChange={(e) => setForm({ ...form, pricingModel: e.target.value })}>
              {['FREE','PER_HOUR','CONTRACT','MIXED'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="number" className="rounded-md border px-3 py-2 text-sm" placeholder="Hourly rate ($)" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
          </div>
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save Venue</button>
        </form>
      )}

      {venues.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>No venues yet. Add your first venue to start receiving bookings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {venues.map((venue: any) => (
            <div key={venue.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div>
                <h3 className="font-semibold">{venue.name}</h3>
                <p className="text-sm text-muted-foreground">{venue.type} · Capacity: {venue.capacity} · {venue.pricingModel}</p>
              </div>
              <div className="flex gap-2">
                <a href={`/dashboard/venues/${venue.id}/timeslots`} className="rounded-md border px-3 py-1.5 text-xs">Time Slots</a>
                <button onClick={async () => { await api.delete(`/venues/${venue.id}`); loadData(); }} className="rounded-md border border-destructive px-3 py-1.5 text-xs text-destructive">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
