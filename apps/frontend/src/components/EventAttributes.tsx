"use client";

import { Badge } from "@/components/ui/badge";

/**
 * Renders an event's type-specific `attributes` payload. Values are formatted
 * generically: string arrays become chips, primitives become text, and objects
 * are JSON-serialized. Keys are humanized (camelCase -> Title Case).
 */
export function EventAttributes({
  attributes,
  attributesSchema,
}: {
  attributes?: Record<string, any> | null;
  attributesSchema?: Record<string, any> | null;
}) {
  if (!attributes || typeof attributes !== "object") return null;

  const entries = Object.entries(attributes).filter(
    ([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
  );

  if (entries.length === 0) return null;

  const labelFor = (key: string) =>
    key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

  const renderValue = (key: string, value: any) => {
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <Badge key={String(item)} variant="accent" className="text-[11px]">
              {String(item).replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      );
    }
    if (typeof value === "boolean") {
      return <span className="text-foreground">{value ? "Yes" : "No"}</span>;
    }
    if (typeof value === "object") {
      return (
        <span className="text-sm text-foreground break-words">{JSON.stringify(value)}</span>
      );
    }
    return <span className="text-foreground">{String(value)}</span>;
  };

  // Prefer schema-provided titles when available.
  const schemaProps = (attributesSchema as any)?.properties ?? {};

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {(schemaProps[key] as any)?.title || labelFor(key)}
          </dt>
          <dd className="mt-1">{renderValue(key, value)}</dd>
        </div>
      ))}
    </div>
  );
}
