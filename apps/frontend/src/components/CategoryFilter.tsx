"use client";

import Link from "next/link";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  { key: "CONCERT", label: "Concerts", icon: "\u{1F3B5}" },
  { key: "WORKSHOP", label: "Workshops", icon: "\u{1F3B8}" },
  { key: "JAM_SESSION", label: "Jam Sessions", icon: "\u{1F3B7}" },
  { key: "OPEN_MIC", label: "Open Mic", icon: "\u{1F3A4}" },
  { key: "FESTIVAL", label: "Festivals", icon: "\u{1F389}" },
  { key: "CLASS", label: "Classes", icon: "\u{1F3AB}" },
  { key: "PRIVATE_PARTY", label: "Private Parties", icon: "\u{1F389}" },
  { key: "CORPORATE_EVENT", label: "Corporate", icon: "\u{1F3E2}" },
];

export function CategoryFilter() {
  const { trackCategoryBrowse } = useAnalytics();

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => (
        <Link
          key={cat.key}
          href={`/category/${cat.key.toLowerCase()}`}
          onClick={() => trackCategoryBrowse(cat.key)}
        >
          <Badge
            variant="secondary"
            className="cursor-pointer px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/15 hover:text-primary"
          >
            <span className="mr-1.5">{cat.icon}</span>
            {cat.label}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
