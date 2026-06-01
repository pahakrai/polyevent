"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { upsertMusicianProfile } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"];

const INTENTS = [
  { value: "LOOKING_TO_JOIN", label: "Looking to join a band/group" },
  { value: "LOOKING_FOR_MEMBERS", label: "Looking for band members" },
  { value: "OPEN_TO_JAM", label: "Open to jam sessions" },
  { value: "JUST_BROWSING", label: "Just browsing" },
];

interface Props {
  onComplete?: () => void;
}

export function MusicianProfileForm({ onComplete }: Props) {
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<1 | 2>(1);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("INTERMEDIATE");
  const [genres, setGenres] = useState<string[]>([]);
  const [intent, setIntent] = useState("OPEN_TO_JAM");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleItem = (item: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const handleSave = async () => {
    if (instruments.length === 0) {
      setError("Select at least one instrument");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await upsertMusicianProfile({
        instruments,
        skillLevel,
        genres,
        intent,
        lookingFor: intent === "LOOKING_FOR_MEMBERS" ? lookingFor : [],
      });
      onComplete?.();
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {step === 1 ? (
        <>
          <div>
            <h2 className="text-xl font-bold">What do you play?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select all instruments you play
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {INSTRUMENTS.map((inst) => (
              <Badge
                key={inst}
                variant={instruments.includes(inst) ? "accent" : "outline"}
                className="cursor-pointer px-3 py-1.5 text-sm"
                onClick={() => toggleItem(inst, instruments, setInstruments)}
              >
                {inst.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium">Skill level</label>
            <div className="mt-2 flex gap-2">
              {SKILL_LEVELS.map((lvl) => (
                <Badge
                  key={lvl}
                  variant={skillLevel === lvl ? "accent" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-sm"
                  onClick={() => setSkillLevel(lvl)}
                >
                  {lvl.charAt(0) + lvl.slice(1).toLowerCase()}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Genres you like</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <Badge
                  key={g}
                  variant={genres.includes(g) ? "accent" : "outline"}
                  className="cursor-pointer px-2 py-1 text-xs"
                  onClick={() => toggleItem(g, genres, setGenres)}
                >
                  {g.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>

          <Button onClick={() => setStep(2)} disabled={instruments.length === 0} className="w-full">
            Next
          </Button>
        </>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-bold">What are you looking for?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell others what you want to do
            </p>
          </div>

          <div className="space-y-2">
            {INTENTS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  intent === opt.value
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="intent"
                  value={opt.value}
                  checked={intent === opt.value}
                  onChange={(e) => setIntent(e.target.value)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>

          {intent === "LOOKING_FOR_MEMBERS" && (
            <div>
              <label className="text-sm font-medium">Instruments you need</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {INSTRUMENTS.map((inst) => (
                  <Badge
                    key={inst}
                    variant={lookingFor.includes(inst) ? "accent" : "outline"}
                    className="cursor-pointer px-2 py-1 text-xs"
                    onClick={() => toggleItem(inst, lookingFor, setLookingFor)}
                  >
                    {inst.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
              Back
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
