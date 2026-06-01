"use client";

import { useState } from "react";
import { createGroupPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const POST_TYPES = [
  { value: "DISCUSSION", label: "Discussion" },
  { value: "LOOKING_FOR", label: "Looking For" },
  { value: "ANNOUNCEMENT", label: "Announcement" },
];

interface Props {
  groupId: string;
  onPostCreated: () => void;
}

export function GroupPostComposer({ groupId, onPostCreated }: Props) {
  const [type, setType] = useState("DISCUSSION");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await createGroupPost(groupId, { type, title: title || undefined, content });
      setContent("");
      setTitle("");
      onPostCreated();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex gap-2">
        {POST_TYPES.map((pt) => (
          <Badge
            key={pt.value}
            variant={type === pt.value ? "accent" : "outline"}
            className="cursor-pointer"
            onClick={() => setType(pt.value)}
          >
            {pt.label}
          </Badge>
        ))}
      </div>
      {type !== "DISCUSSION" && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === "LOOKING_FOR" ? "e.g. Looking for a drummer" : "Announcement title"}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={type === "LOOKING_FOR" ? "Describe what you need..." : "What's on your mind?"}
        rows={3}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={saving || !content.trim()} size="sm">
          {saving ? "Posting..." : "Post"}
        </Button>
      </div>
    </div>
  );
}
