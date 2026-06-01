"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJamSession } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const INSTRUMENTS = [
  "GUITAR", "BASS", "DRUMS", "PIANO", "KEYBOARD", "VOCALS",
  "VIOLIN", "CELLO", "SAXOPHONE", "TRUMPET", "TROMBONE",
  "FLUTE", "CLARINET", "HARMONICA", "UKULELE", "SYNTH",
  "DJ", "PRODUCER", "OTHER",
];

const GENRES = [
  "ROCK", "JAZZ", "BLUES", "POP", "CLASSICAL", "HIP_HOP",
  "R_B", "ELECTRONIC", "FOLK", "METAL", "PUNK", "FUNK",
  "SOUL", "REGGAE", "COUNTRY", "LATIN", "INDIE", "AMBIENT",
];

export function CreateJamForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [instrumentsWanted, setInstrumentsWanted] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleTag = (item: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !startTime) {
      setError("Title, date, and start time are required");
      return;
    }
    if (instrumentsWanted.length === 0) {
      setError("Select at least one instrument you're looking for");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const jam = await createJamSession({
        title,
        description,
        startTime: `${date}T${startTime}:00`,
        endTime: endTime ? `${date}T${endTime}:00` : `${date}T23:59:00`,
        location: {
          name: location || undefined,
          city: city || undefined,
          venueName: location || undefined,
        },
        instrumentsWanted,
        genres,
        maxParticipants,
      });
      router.push(`/jams/${jam.id}`);
    } catch {
      setError("Failed to create jam session. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-bold">Host a Jam Session</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Propose a casual jam — no tickets, no payment
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sunday Jazz Jam at Central Park"
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What kind of music? Any specific songs? What to bring?"
            rows={3}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Location</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Central Park"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">City</label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. New York"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Start</label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">End</label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Instruments you need</label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {INSTRUMENTS.map((inst) => (
            <Badge
              key={inst}
              variant={instrumentsWanted.includes(inst) ? "accent" : "outline"}
              className="cursor-pointer px-2 py-1 text-xs"
              onClick={() => toggleTag(inst, instrumentsWanted, setInstrumentsWanted)}
            >
              {inst.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Genres (optional)</label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {GENRES.slice(0, 12).map((g) => (
            <Badge
              key={g}
              variant={genres.includes(g) ? "accent" : "outline"}
              className="cursor-pointer px-2 py-1 text-xs"
              onClick={() => toggleTag(g, genres, setGenres)}
            >
              {g.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">
          Max participants: {maxParticipants}
        </label>
        <input
          type="range"
          min={2}
          max={20}
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Creating..." : "Create Jam Session"}
      </Button>
    </form>
  );
}
