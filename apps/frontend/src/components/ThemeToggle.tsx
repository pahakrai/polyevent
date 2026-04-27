"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-9 w-9 rounded-md border border-border bg-background",
          className,
        )}
      />
    );
  }

  const cycles: Record<string, { next: string; Icon: typeof Sun }> = {
    light: { next: "dark", Icon: Sun },
    dark: { next: "system", Icon: Moon },
    system: { next: "light", Icon: Monitor },
  };

  const current = cycles[theme ?? "system"];
  const Icon = current.Icon;

  return (
    <button
      onClick={() => setTheme(current.next)}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground",
        className,
      )}
      aria-label={`Theme: ${theme}. Click to switch to ${current.next}.`}
      title={`Theme: ${theme} — switch to ${current.next}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
