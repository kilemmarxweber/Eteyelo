"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { HomeEvent, HomeSchool } from "@/lib/home/home-data";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { cn } from "@/lib/utils";

type SpotlightSlide = {
  id: string;
  name: string;
  city: string;
  note: string;
  image: string;
  href: string;
};

type HomeSpotlightSectionProps = {
  schools: HomeSchool[];
  events: HomeEvent[];
  intervalMs?: number;
};

function schoolSpotlightImage(school: HomeSchool, fallback: string) {
  return (
    school.ecole.find(Boolean) ||
    school.event.find(Boolean) ||
    school.gallery.find(Boolean) ||
    school.logo ||
    fallback
  );
}

function EventCard({
  event,
  className,
}: {
  event: HomeEvent;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        <Image
          src={event.image || KLAMBOCORE_DEFAULT_IMAGE_PATH}
          alt={event.title}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 360px"
          unoptimized
        />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">
            {event.category}
          </Badge>
          <Badge className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100">
            <Clock className="size-3" />
            {event.dateLabel || event.date}
          </Badge>
        </div>
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900">
          {event.title}
        </h3>
        <p className="mt-auto text-xs text-slate-500">{event.school}</p>
      </div>
    </article>
  );
}

export function HomeSpotlightSection({
  schools,
  events,
  intervalMs = 5000,
}: HomeSpotlightSectionProps) {
  const slides = useMemo<SpotlightSlide[]>(() => {
    const fallback = KLAMBOCORE_DEFAULT_IMAGE_PATH;
    return schools
      .map((school) => ({
        id: school.id,
        name: school.name,
        city: school.city,
        note: school.note?.trim() || school.heroTitle,
        image: schoolSpotlightImage(school, fallback),
        href: `/etablissements/${school.id}`,
      }))
      .filter((slide) => Boolean(slide.image));
  }, [schools]);

  const eventList = events.length > 0 ? events : [];
  const [schoolIndex, setSchoolIndex] = useState(0);
  const [eventOffset, setEventOffset] = useState(0);

  useEffect(() => {
    if (slides.length <= 1 && eventList.length <= 2) return;

    const timer = window.setInterval(() => {
      if (slides.length > 1) {
        setSchoolIndex((current) => (current + 1) % slides.length);
      }
      if (eventList.length > 2) {
        setEventOffset((current) => (current + 1) % eventList.length);
      } else if (eventList.length === 2) {
        setEventOffset((current) => (current + 1) % 2);
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [eventList.length, intervalMs, slides.length]);

  if (slides.length === 0 && eventList.length === 0) {
    return null;
  }

  const activeSlide = slides[schoolIndex] ?? slides[0];
  const visibleEvents =
    eventList.length === 0
      ? []
      : eventList.length === 1
        ? [eventList[0]]
        : [
            eventList[eventOffset % eventList.length],
            eventList[(eventOffset + 1) % eventList.length],
          ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-14">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-black tracking-tight text-blue-950 sm:text-4xl">
          À la une des établissements
        </h2>
        <p className="mx-auto mt-2 max-w-7xl text-sm text-slate-600 sm:text-base">
          Explorez les actualités et événements des écoles partenaires
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-stretch">
        {activeSlide ? (
          <div className="group relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 transition hover:shadow-md">
            <Link href={activeSlide.href} className="flex min-h-0 flex-1 flex-col">
              <div className="relative aspect-[16/11] w-full overflow-hidden bg-slate-100 sm:aspect-[16/10] lg:aspect-auto lg:min-h-[280px] lg:flex-1">
                <Image
                  key={activeSlide.id}
                  src={activeSlide.image}
                  alt={activeSlide.name}
                  fill
                  className="object-cover transition duration-700 group-hover:scale-[1.03]"
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  unoptimized
                  priority
                />
              </div>
              <div className="flex flex-col gap-2.5 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">
                    Établissement
                  </Badge>
                  <Badge className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100">
                    {activeSlide.city}
                  </Badge>
                </div>
                <h3 className="line-clamp-2 text-xl font-black leading-snug text-slate-900">
                  {activeSlide.name}
                </h3>
                {activeSlide.note ? (
                  <p className="line-clamp-3 text-sm leading-6 text-slate-600">
                    {activeSlide.note}
                  </p>
                ) : null}
              </div>
            </Link>
            {slides.length > 1 ? (
              <div className="flex gap-1.5 px-5 pb-5">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={`Voir ${slide.name}`}
                    onClick={() => setSchoolIndex(index)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      index === schoolIndex
                        ? "w-6 bg-blue-700"
                        : "w-1.5 bg-slate-300 hover:bg-slate-400",
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="min-h-[420px] rounded-2xl bg-slate-100" />
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 lg:content-stretch">
          {visibleEvents.length > 0 ? (
            visibleEvents.map((event, index) => (
              <EventCard
                key={`${event.title}-${event.school}-${eventOffset}-${index}`}
                event={event}
                className="min-h-[200px] lg:min-h-0"
              />
            ))
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 lg:min-h-full">
              Aucun événement publié pour le moment.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/evenements"
          className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-200"
        >
          Voir tous les événements
        </Link>
      </div>
    </section>
  );
}
