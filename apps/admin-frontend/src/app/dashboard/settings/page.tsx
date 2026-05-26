'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  Save,
  User,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth-store';

export default function SettingsPage() {
  const user = useAdminAuthStore((s) => s.user);
  const [vendor, setVendor] = useState<any>(null);
  const [form, setForm] = useState({
    businessName: '',
    description: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('authToken');
        if (!token || !user) return;
        const payload = JSON.parse(atob(token.split('.')[1]));
        const { data: v } = await api.get(`/vendors/user/${payload.sub}`);
        if (v) {
          setVendor(v);
          setForm({
            businessName: v.businessName || '',
            description: v.description || '',
            contactEmail: v.contactEmail || '',
            contactPhone: v.contactPhone || '',
            website: v.website || '',
          });
        }
      } catch {
        /* no vendor yet */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;
    await api.patch(`/vendors/${vendor.id}`, form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your vendor profile and preferences.
        </p>
      </div>

      {/* Success toast */}
      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <Check className="h-4 w-4" />
          Profile updated successfully
        </div>
      )}

      {/* Profile form */}
      <form onSubmit={handleSave}>
        <div className="rounded-xl border border-border/50 bg-card">
          <div className="border-b border-border/50 px-6 py-4">
            <h3 className="text-sm font-semibold">Business Profile</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              This information is visible to clients on your public vendor page.
            </p>
          </div>

          <div className="space-y-5 p-6">
            {/* Business name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Business Name
              </label>
              <input
                className={inputClass}
                value={form.businessName}
                onChange={(e) =>
                  setForm({ ...form, businessName: e.target.value })
                }
                placeholder="Your business name"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>
              <textarea
                className={inputClass}
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Describe your services, specialties, and what makes you unique..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {form.description.length}/1000
              </p>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Contact Email
                </label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm({ ...form, contactEmail: e.target.value })
                  }
                  placeholder="hello@business.com"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Contact Phone
                </label>
                <input
                  className={inputClass}
                  value={form.contactPhone}
                  onChange={(e) =>
                    setForm({ ...form, contactPhone: e.target.value })
                  }
                  placeholder="+1 (555) 000-0000"
                  required
                />
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Website
              </label>
              <input
                className={inputClass}
                value={form.website}
                onChange={(e) =>
                  setForm({ ...form, website: e.target.value })
                }
                placeholder="https://yourbusiness.com"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
            <span className="text-xs text-muted-foreground">
              Changes are saved immediately.
            </span>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
        </div>
      </form>

      {/* Vendor ID card */}
      {vendor && (
        <div className="rounded-xl border border-border/50 bg-card">
          <div className="border-b border-border/50 px-6 py-4">
            <h3 className="text-sm font-semibold">Vendor Information</h3>
          </div>
          <div className="space-y-3 p-6">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Vendor ID
                </p>
                <p className="mt-0.5 font-mono text-sm">{vendor.id}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(vendor.id)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Copy Vendor ID"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Verification Status
                </p>
                <p
                  className={`mt-0.5 text-sm font-medium ${
                    vendor.verificationStatus === 'VERIFIED'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {vendor.verificationStatus || 'PENDING'}
                </p>
              </div>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  vendor.verificationStatus === 'VERIFIED'
                    ? 'bg-emerald-500/10'
                    : 'bg-amber-500/10'
                }`}
              >
                {vendor.verificationStatus === 'VERIFIED' ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <User className="h-4 w-4 text-amber-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
