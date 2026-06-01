"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { GroupPost } from "@/lib/api";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ANNOUNCEMENT: { label: "Announcement", color: "bg-amber-100 text-amber-800" },
  LOOKING_FOR: { label: "Looking For", color: "bg-blue-100 text-blue-800" },
  DISCUSSION: { label: "Discussion", color: "bg-muted text-muted-foreground" },
  EVENT: { label: "Event", color: "bg-green-100 text-green-800" },
  POLL: { label: "Poll", color: "bg-purple-100 text-purple-800" },
};

interface Props {
  post: GroupPost;
}

export function GroupPostCard({ post }: Props) {
  const typeCfg = TYPE_LABELS[post.type] || TYPE_LABELS.DISCUSSION;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeCfg.color}`}>
          {typeCfg.label}
        </span>
        {post.title && (
          <span className="font-medium text-sm">{post.title}</span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(post.createdAt).toLocaleDateString()}
        </span>
      </div>

      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{post.content}</p>

      {post.instrumentsWanted?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {post.instrumentsWanted.map((inst) => (
            <Badge key={inst} variant="accent" className="text-[10px]">
              {inst.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      )}

      {post.eventId && (
        <Link
          href={`/jams/${post.eventId}`}
          className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
        >
          View jam session →
        </Link>
      )}
    </Card>
  );
}
