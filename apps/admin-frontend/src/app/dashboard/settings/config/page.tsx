'use client';

import { useEffect, useState } from 'react';
import {
  Settings,
  Save,
  RefreshCw,
  Check,
  AlertCircle,
  Clock,
  DollarSign,
  Zap,
  Lock,
} from 'lucide-react';
import { api } from '@/lib/api';

const BOOKING_API = process.env.NEXT_PUBLIC_BOOKING_API_URL || 'http://localhost:3007';

interface ConfigItem {
  key: string;
  value: any;
  description: string;
}

function ConfigRow({
  item,
  onSave,
}: {
  item: ConfigItem;
  onSave: (key: string, value: any) => Promise<void>;
}) {
  const [value, setValue] = useState(String(item.value));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isBool = typeof item.value === 'boolean';
  const isNum = typeof item.value === 'number';

  useEffect(() => setValue(String(item.value)), [item.value]);

  const handleSave = async () => {
    setSaving(true);
    const parsed = isBool ? value === 'true' : isNum ? Number(value) : value;
    await onSave(item.key, parsed);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex items-center gap-4 rounded-lg bg-muted/30 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.key}</p>
        <p className="text-xs text-muted-foreground">{item.description || 'No description'}</p>
      </div>
      <div className="flex items-center gap-2">
        {isBool ? (
          <button
            onClick={() => onSave(item.key, !item.value)}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              item.value
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${item.value ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {item.value ? 'Enabled' : 'Disabled'}
          </button>
        ) : (
          <input
            type={isNum ? 'number' : 'text'}
            className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        )}
        {!isBool && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
            {saved ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  payment: DollarSign,
  booking: Lock,
  feature: Zap,
  general: Settings,
};

export default function AppConfigPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`${BOOKING_API}/admin/config`);
      setConfigs(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleSave = async (key: string, value: any) => {
    try {
      await api.patch(`${BOOKING_API}/admin/config`, { key, value });
      setConfigs((prev) =>
        prev.map((c) => (c.key === key ? { ...c, value } : c)),
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save');
    }
  };

  // Group by category prefix
  const grouped = configs.reduce(
    (acc, c) => {
      const cat = c.key.split('.')[0] || 'general';
      (acc[cat] = acc[cat] || []).push(c);
      return acc;
    },
    {} as Record<string, ConfigItem[]>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Platform Config</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Runtime settings — changes take effect immediately. No restart needed.
          </p>
        </div>
        <button
          onClick={loadConfigs}
          className="inline-flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => {
            const Icon = CATEGORY_ICONS[category] || Settings;
            return (
              <div key={category} className="rounded-xl border border-border/50 bg-card">
                <div className="flex items-center gap-2 border-b border-border/50 px-5 py-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold capitalize">{category}</h3>
                </div>
                <div className="divide-y divide-border/30 p-3">
                  {items.map((item) => (
                    <ConfigRow key={item.key} item={item} onSave={handleSave} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
