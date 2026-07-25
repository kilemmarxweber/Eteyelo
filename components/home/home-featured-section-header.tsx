"use client";

import { useEffect, useState } from "react";

import type { HomeStatsSegment } from "@/lib/home/home-data";
import { cn } from "@/lib/utils";

const FEATURED_COPY: Record<
  HomeStatsSegment["key"],
  { badge: string; subtitle: string }
> = {
  schools: {
    badge: "Écoles partenaires",
    subtitle:
      "Événements et moments forts des écoles partenaires — classes, filières et vie scolaire.",
  },
  centres: {
    badge: "Centres de formation",
    subtitle:
      "Événements et moments forts des centres de formation — sessions, certifications et parcours pro.",
  },
  universities: {
    badge: "Universités partenaires",
    subtitle:
      "Événements et moments forts des universités — auditoires, filières et vie académique.",
  },
};

type HomeFeaturedSectionHeaderProps = {
  segments: HomeStatsSegment[];
  intervalMs?: number;
};

export function HomeFeaturedSectionHeader({
  segments,
  intervalMs = 5000,
}: HomeFeaturedSectionHeaderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (segments.length <= 1) return;

    const timer = window.setInterval(() => {
      setIsTransitioning(true);
      window.setTimeout(() => {
        setActiveIndex((current) => (current + 1) % segments.length);
        setIsTransitioning(false);
      }, 220);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, segments.length]);

  const segment = segments[activeIndex] ?? segments[0];
  const copy = FEATURED_COPY[segment?.key ?? "schools"];

  return (
    <div>
      <span
        className={cn(
          "inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 transition-all duration-300",
          isTransitioning ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        {copy.badge}
      </span>

      <h2 className="mt-3 text-3xl font-black text-blue-950">
        À la une des établissements
      </h2>

      <p
        className={cn(
          "mt-2 max-w-7xl text-sm text-slate-600 transition-all duration-300",
          isTransitioning ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        {copy.subtitle}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {segments.map((item, index) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold transition",
              index === activeIndex
                ? "bg-blue-950 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {item.title}
          </button>
        ))}
      </div>
    </div>
  );
}
