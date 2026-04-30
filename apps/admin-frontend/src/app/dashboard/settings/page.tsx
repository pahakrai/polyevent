'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth-store';

export default function SettingsPage() {
  const user = useAdminAuthStore((s) => s.user);
  const [vendor, setVendor] = useState<any>(null);
  const [form, setForm] = useState({ businessName: '', description: '', contactEmail: '', contactPhone: '', website: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('authToken');
        if (!token || !user) return;
        const payload = JSON.parse(atob(token.split('.')[1]));
        const { data: v } = await api.get(`/vendors/user/${payload.sub}`);
        if (v) {
          setVendor(v);
          setForm({ businessName: v.businessName || '', description: v.description || '', contactEmail: v.contactEmail || '', contactPhone: v.contactPhone || '', website: v.website || '' });
        }
      } catch { /* no vendor yet */ }
    }
    load();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;
    await api.patch(`/vendors/${vendor.id}`, form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Settings</h2>
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Vendor Profile</h3>
        {saved && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">Settings saved successfully.</div>}
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <div>
            <label className="text-sm font-medium">Business Name</label>
            <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Contact Email</label>
            <input type="email" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required />
          </div>
          <div>
            <label className="text-sm font-medium">Contact Phone</label>
            <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} required />
          </div>
          <div>
            <label className="text-sm font-medium">Website</label>
            <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save Changes</button>
        </form>
      </div>
    </div>
  );
}
