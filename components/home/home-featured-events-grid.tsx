"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { HomeEvent, HomeSchool } from "@/lib/home/home-data";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { cn } from "@/lib/utils";

type HomeFeaturedEventsGridProps = {
  schools: HomeSchool[];
  events: HomeEvent[];
  pageSize?: number;
  intervalMs?: number;
};

function schoolImage(school: HomeSchool, fallback: string) {
  return (
    school.ecole.find(Boolean) ||
    school.event.find(Boolean) ||
    school.gallery.find(Boolean) ||
    school.logo ||
    fallback
  );
}

export function HomeFeaturedEventsGrid({
  schools,
  events,
  pageSize = 4,
  intervalMs = 5000,
}: HomeFeaturedEventsGridProps) {
  const slides = useMemo(
    () =>
      schools
        .map((school) => ({
          id: school.id,
          name: school.name,
          city: school.city,
          note: school.note?.trim() || school.heroTitle,
          image: schoolImage(school, KLAMBOCORE_DEFAULT_IMAGE_PATH),
          href: `/etablissements/${school.id}`,
        }))
        .filter((slide) => Boolean(slide.image)),
    [schools],
  );

  const [schoolIndex, setSchoolIndex] = useState(0);
  const [eventOffset, setEventOffset] = useState(0);

  useEffect(() => {
    if (slides.length <= 1 && events.length <= pageSize) return;

    const timer = window.setInterval(() => {
      if (slides.length > 1) {
        setSchoolIndex((current) => (current + 1) % slides.length);
      }
      if (events.length > pageSize) {
        setEventOffset((current) => (current + pageSize) % events.length);
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [events.length, intervalMs, pageSize, slides.length]);

  const activeSlide = slides[schoolIndex] ?? slides[0];
  const visibleEvents =
    events.length === 0
      ? []
      : Array.from({ length: Math.min(pageSize, events.length) }, (_, i) => {
          return events[(eventOffset + i) % events.length];
        });

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
      {/* Image établissement + note (comme à la une) */}
      {activeSlide ? (
        <div className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100">
          <Link
            href={activeSlide.href}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="relative aspect-[16/11] w-full overflow-hidden bg-slate-100 lg:aspect-auto lg:min-h-[220px] lg:flex-1">
              <Image
                key={activeSlide.id}
                src={activeSlide.image}
                alt={activeSlide.name}
                fill
                className="object-cover transition duration-700 group-hover:scale-[1.03]"
                sizes="(max-width: 1024px) 100vw, 40vw"
                unoptimized
                priority
              />
            </div>
            <div className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className="rounded-full bg-rose-100 px-2 py-0 text-[10px] font-semibold text-rose-700 hover:bg-rose-100">
                  Établissement
                </Badge>
                <Badge className="rounded-full bg-sky-100 px-2 py-0 text-[10px] font-semibold text-sky-700 hover:bg-sky-100">
                  {activeSlide.city}
                </Badge>
              </div>
              <h3 className="line-clamp-2 text-base font-black leading-snug text-blue-950">
                {activeSlide.name}
              </h3>
              {activeSlide.note ? (
                <p className="line-clamp-3 text-xs leading-5 text-slate-600">
                  {activeSlide.note}
                </p>
              ) : null}
            </div>
          </Link>
          {slides.length > 1 ? (
            <div className="flex gap-1.5 px-4 pb-4">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Voir ${slide.name}`}
                  onClick={() => setSchoolIndex(index)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === schoolIndex
                      ? "w-5 bg-blue-700"
                      : "w-1.5 bg-slate-300 hover:bg-slate-400",
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="min-h-[320px] rounded-2xl bg-slate-100" />
      )}

      {/* 4 petites cartes événements */}
      {visibleEvents.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 content-start">
          {visibleEvents.map((event, index) => (
            <article
              key={`${event.title}-${event.school}-${eventOffset}-${index}`}
              className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                <Image
                  src={event.image || KLAMBOCORE_DEFAULT_IMAGE_PATH}
                  alt={event.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 40vw, 200px"
                  unoptimized
                />
              </div>
              <div className="space-y-1.5 p-2.5">
                <div className="flex flex-wrap items-center gap-1">
                  <Badge className="rounded-full bg-rose-100 px-1.5 py-0 text-[9px] font-semibold text-rose-700 hover:bg-rose-100">
                    {event.category}
                  </Badge>
                  <Badge className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0 text-[9px] font-semibold text-sky-700 hover:bg-sky-100">
                    <Clock className="size-2.5" />
                    {event.dateLabel || event.date}
                  </Badge>
                </div>
                <h3 className="line-clamp-2 text-xs font-bold leading-snug text-blue-950">
                  {event.title}
                </h3>
                <p className="truncate text-[10px] text-slate-500">
                  {event.school}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-blue-100 bg-white p-6 text-center text-sm text-slate-500">
          Aucun événement publié pour le moment.
        </div>
      )}
    </div>
  );
}

export function HomeFeaturedEventsFooter() {
  return (
    <div className="mt-4">
      <Link
        href="/evenements"
        className="inline-flex rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200"
      >
        Voir tous les événements →
      </Link>
    </div>
  );
}
