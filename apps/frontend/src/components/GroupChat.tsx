"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { sendGroupMessage, getGroupMessages, type GroupMessage } from "@/lib/api";

interface Props {
  groupId: string;
}

export function GroupChat({ groupId }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchMessages = async (after?: string) => {
    try {
      const res = await getGroupMessages(groupId, after);
      if (after) {
        setMessages((prev) => [...res.data, ...prev]);
      } else {
        setMessages(res.data);
      }
      setHasMore(res.hasMore);
    } catch {
      // ignore
    }
  };

  // Initial load
  useEffect(() => {
    fetchMessages();
  }, [groupId]);

  // Poll every 3 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => {
      const lastId = messages[messages.length - 1]?.id;
      if (lastId) fetchMessages(lastId);
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [groupId, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    try {
      await sendGroupMessage(groupId, text);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Sign in to join the conversation</p>
      </div>
    );
  }

  return (
    <div className="flex h-[500px] flex-col rounded-lg border bg-card">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
              {msg.userId?.slice(0, 2).toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {msg.userId?.slice(0, 8)} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
