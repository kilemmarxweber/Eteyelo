"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { branchImageBackgroundStyle, cn } from "@/lib/utils";

export type HeroSchoolSlide = {
  id: string;
  heroLabel: string;
  heroTitle: string;
  image: string;
};

type HeroSchoolRotatorProps = {
  slides: HeroSchoolSlide[];
  intervalMs?: number;
};

/**
 * Carrousel hero des images d’établissements :
 * rotation JS fiable entre branches (évite le keyframe CSS figé).
 */
export function HeroSchoolRotator({
  slides,
  intervalMs = 5000,
}: HeroSchoolRotatorProps) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;

    const timer = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % slides.length);
        setFading(false);
      }, 320);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, paused, slides.length]);

  if (slides.length === 0) {
    return (
      <div className="relative z-10 flex min-h-[260px] items-end rounded-[1.25rem] bg-blue-950/45 p-4 sm:min-h-[340px] sm:rounded-[1.5rem] sm:p-5 lg:min-h-[400px]">
        <div className="w-full rounded-2xl bg-white p-4 text-slate-900 shadow-xl sm:w-[26rem] sm:p-5">
          <p className="text-sm font-bold text-blue-600">
            Établissement partenaire vérifié
          </p>
          <h3 className="mt-1 text-lg font-black sm:text-xl">
            Donnez plus de visibilité à votre établissement
          </h3>
        </div>
      </div>
    );
  }

  const active = slides[index] ?? slides[0];

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, slideIndex) => {
        const isActive = slideIndex === index;

        return (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-500 ease-out",
              isActive && !fading
                ? "z-[1] opacity-100"
                : "pointer-events-none z-0 opacity-0",
            )}
            aria-hidden={!isActive}
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700"
              style={branchImageBackgroundStyle(slide.image)}
            />

            <div className="relative z-10 flex min-h-[260px] items-end rounded-[1.25rem] bg-blue-950/45 p-4 sm:min-h-[340px] sm:rounded-[1.5rem] sm:p-5 lg:min-h-[400px]">
              <Link
                href={`/etablissements/${slide.id}`}
                className="w-full rounded-2xl bg-white p-4 text-slate-900 shadow-xl transition hover:bg-slate-50 sm:w-[26rem] sm:p-5"
              >
                <p className="text-sm font-bold text-blue-600">
                  {slide.heroLabel}
                </p>
                <h3 className="mt-1 text-lg font-black sm:text-xl">
                  {slide.heroTitle}
                </h3>
              </Link>
            </div>
          </div>
        );
      })}

      {slides.length > 1 ? (
        <div className="absolute bottom-3 right-3 z-20 flex gap-1.5 sm:bottom-4 sm:right-4">
          {slides.map((slide, slideIndex) => (
            <button
              key={`dot-${slide.id}`}
              type="button"
              aria-label={`Voir ${slide.heroTitle}`}
              onClick={() => {
                setFading(false);
                setIndex(slideIndex);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all",
                slideIndex === index
                  ? "w-5 bg-white"
                  : "w-1.5 bg-white/50 hover:bg-white/80",
              )}
            />
          ))}
        </div>
      ) : null}

      {/* Keep a11y announcement of current school */}
      <span className="sr-only">
        Établissement affiché : {active.heroTitle}
      </span>
    </div>
  );
}
