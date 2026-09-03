"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, MapPin, Users } from "lucide-react";

import type { HomeSchool } from "@/lib/home/home-data";
import { cn } from "@/lib/utils";

export type HomeGalleryItem = {
  src: string;
  schoolName: string;
  schoolId: string;
  city: string;
  students: number;
  peopleLabel: string;
};

type HomeGallerySectionProps = {
  schools: HomeSchool[];
  fallbackImages?: string[];
  visibleCount?: number;
  intervalMs?: number;
};

const SLOT_COUNT = 6;

function buildGalleryPool(
  schools: HomeSchool[],
  fallbackImages: string[],
): HomeGalleryItem[] {
  const seen = new Set<string>();
  const items: HomeGalleryItem[] = [];

  for (const school of schools) {
    const urls = [...school.gallery, ...school.ecole, ...school.event].filter(
      (url): url is string =>
        typeof url === "string" && url.trim().length > 0,
    );

    for (const src of urls) {
      if (seen.has(src)) continue;
      seen.add(src);
      items.push({
        src,
        schoolName: school.name,
        schoolId: school.id,
        city: school.city,
        students: school.students,
        peopleLabel: school.peopleLabelPlural,
      });
    }
  }

  for (const src of fallbackImages) {
    if (!src?.trim() || seen.has(src)) continue;
    seen.add(src);
    items.push({
      src,
      schoolName: "Klambocore",
      schoolId: "",
      city: "",
      students: 0,
      peopleLabel: "",
    });
  }

  return items;
}

function GalleryTile({
  item,
  fading,
  onHoverChange,
}: {
  item: HomeGalleryItem | null;
  fading: boolean;
  onHoverChange: (hovered: boolean) => void;
}) {
  const src = item?.src?.trim() || "";
  const href = item?.schoolId ? `/etablissements/${item.schoolId}` : "/galerie";

  const content = (
    <>
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center transition-all duration-500 ease-out will-change-transform",
          fading ? "scale-105 opacity-0" : "scale-100 opacity-100",
          "group-hover:scale-125",
          !src && "bg-gradient-to-br from-blue-950 to-cyan-700",
        )}
        style={src ? { backgroundImage: `url('${src}')` } : undefined}
      />

      {/* Overlay détail au hover */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-blue-950/95 via-blue-950/55 to-blue-950/10 px-3 pb-3 pt-10 transition-all duration-300",
          fading
            ? "opacity-0"
            : "opacity-0 group-hover:opacity-100",
        )}
      >
        <p className="line-clamp-2 text-sm font-bold leading-snug text-white">
          {item?.schoolName ?? "Établissement"}
        </p>

        {item?.city ? (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-blue-100">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{item.city}</span>
          </p>
        ) : null}

        {item && item.students > 0 ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-cyan-200">
            <Users className="size-3 shrink-0" />
            {item.students.toLocaleString("fr-FR")}{" "}
            {item.peopleLabel.toLowerCase() || "élèves"}
          </p>
        ) : null}

        {item?.schoolId ? (
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white/90">
            Voir l&apos;établissement
            <ArrowRight className="size-3" />
          </span>
        ) : null}
      </div>

      {/* Label discret hors hover */}
      {item?.schoolName ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-blue-950/75 to-transparent px-2.5 pb-2 pt-6 transition-opacity duration-300",
            fading
              ? "opacity-0"
              : "opacity-100 group-hover:opacity-0",
          )}
        >
          <p className="truncate text-[11px] font-semibold text-white">
            {item.schoolName}
          </p>
        </div>
      ) : null}
    </>
  );

  const className =
    "group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 shadow-sm ring-1 ring-blue-100 transition-shadow duration-300 hover:z-10 hover:shadow-lg hover:ring-blue-300";

  if (item?.schoolId) {
    return (
      <Link
        href={href}
        className={className}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
        onFocus={() => onHoverChange(true)}
        onBlur={() => onHoverChange(false)}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={className}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {content}
    </div>
  );
}

export function HomeGallerySection({
  schools,
  fallbackImages = [],
  visibleCount = SLOT_COUNT,
  intervalMs = 3200,
}: HomeGallerySectionProps) {
  const pool = useMemo(
    () => buildGalleryPool(schools, fallbackImages),
    [schools, fallbackImages],
  );

  const slotCount = Math.min(visibleCount, Math.max(pool.length, 1));
  const [offset, setOffset] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (pool.length <= slotCount || paused) return;

    const timer = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setOffset((current) => (current + 1) % pool.length);
        setFading(false);
      }, 380);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, paused, pool.length, slotCount]);

  const visibleItems = useMemo(() => {
    if (pool.length === 0) return [];
    return Array.from({ length: slotCount }, (_, index) => {
      return pool[(offset + index) % pool.length] ?? null;
    });
  }, [offset, pool, slotCount]);

  if (visibleItems.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-blue-950" />
          <h2 className="text-xl font-black text-blue-950">Galerie photos</h2>
        </div>
        <Link
          href="/galerie"
          className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200"
        >
          Voir plus <ArrowRight className="inline h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {visibleItems.map((item, index) => (
          <GalleryTile
            key={`slot-${index}`}
            item={item}
            fading={fading && pool.length > slotCount && !paused}
            onHoverChange={setPaused}
          />
        ))}
      </div>
    </section>
  );
}
