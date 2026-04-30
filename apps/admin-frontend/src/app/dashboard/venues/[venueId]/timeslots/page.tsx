'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function TimeslotsPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const [slots, setSlots] = useState<any[]>([]);
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    daysOfWeek: [] as number[],
    startTime: '09:00',
    endTime: '17:00',
  });

  const loadData = async () => {
    const { data: v } = await api.get(`/venues/${venueId}`);
    setVenue(v);
    const { data } = await api.get(`/venues/${venueId}/timeslots`);
    setSlots(data.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [venueId]);

  const handleBulkCreate = async () => {
    await api.post(`/venues/${venueId}/timeslots/bulk`, {
      venueId,
      ...bulkForm,
    });
    setShowBulk(false);
    loadData();
  };

  const toggleDay = (day: number) => {
    setBulkForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter((d) => d !== day) : [...f.daysOfWeek, day],
    }));
  };

  const handleBlock = async (slotId: string) => {
    await api.post(`/timeslots/${slotId}/block`);
    loadData();
  };

  const handleDelete = async (slotId: string) => {
    await api.delete(`/timeslots/${slotId}`);
    loadData();
  };

  if (loading) return <div className="animate-pulse">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <a href="/dashboard/venues" className="text-sm text-muted-foreground hover:underline">&larr; All Venues</a>
          <h2 className="text-2xl font-bold">{venue?.name} — Time Slots</h2>
        </div>
        <button onClick={() => setShowBulk(!showBulk)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {showBulk ? 'Cancel' : 'Bulk Create'}
        </button>
      </div>

      {showBulk && (
        <div className="mb-6 rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold">Create Weekly Schedule</h3>
          <div className="flex flex-wrap gap-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, i) => (
              <button key={i} type="button" onClick={() => toggleDay(i)}
                className={`rounded-md border px-3 py-1.5 text-xs ${bulkForm.daysOfWeek.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              >{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3">
            <input type="date" className="rounded-md border px-3 py-2 text-sm" value={bulkForm.startDate} onChange={(e) => setBulkForm({ ...bulkForm, startDate: e.target.value })} />
            <input type="date" className="rounded-md border px-3 py-2 text-sm" value={bulkForm.endDate} onChange={(e) => setBulkForm({ ...bulkForm, endDate: e.target.value })} />
            <input type="time" className="rounded-md border px-3 py-2 text-sm" value={bulkForm.startTime} onChange={(e) => setBulkForm({ ...bulkForm, startTime: e.target.value })} />
            <input type="time" className="rounded-md border px-3 py-2 text-sm" value={bulkForm.endTime} onChange={(e) => setBulkForm({ ...bulkForm, endTime: e.target.value })} />
          </div>
          <button onClick={handleBulkCreate} disabled={bulkForm.daysOfWeek.length === 0} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            Create Slots
          </button>
        </div>
      )}

      {slots.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>No time slots yet. Use Bulk Create to set up your weekly schedule.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slots.slice(0, 50).map((slot: any) => (
            <div key={slot.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div>
                <p className="text-sm font-medium">
                  {new Date(slot.startTime).toLocaleDateString()} — {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <span className={`text-xs ${slot.status === 'AVAILABLE' ? 'text-green-600' : slot.status === 'BOOKED' ? 'text-blue-600' : 'text-gray-500'}`}>
                  {slot.status}
                </span>
              </div>
              <div className="flex gap-2">
                {slot.status === 'AVAILABLE' && (
                  <button onClick={() => handleBlock(slot.id)} className="rounded-md border px-2 py-1 text-xs text-yellow-600">Block</button>
                )}
                <button onClick={() => handleDelete(slot.id)} className="rounded-md border px-2 py-1 text-xs text-destructive">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
