"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { HomeBranchVideo } from "@/lib/home/home-data";
import { cn } from "@/lib/utils";

type HomeBranchVideoPromoProps = {
  videos: HomeBranchVideo[];
  className?: string;
};

/**
 * Pub vidéo en boucle : enchaîne les vidéos des établissements,
 * ou une vidéo stock en ligne si aucune branche n’en a encore.
 */
export function HomeBranchVideoPromo({
  videos,
  className,
}: HomeBranchVideoPromoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);

  const active = videos[index];
  const isDefault = Boolean(active?.isDefault);

  useEffect(() => {
    setIndex(0);
  }, [videos]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !active) return;

    el.load();
    const playPromise = el.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Autoplay bloqué : muted + playsInline déjà présents.
      });
    }
  }, [active, index]);

  if (videos.length === 0 || !active) {
    return null;
  }

  function goNext() {
    if (videos.length <= 1) {
      const el = videoRef.current;
      if (el) {
        el.currentTime = 0;
        void el.play().catch(() => {});
      }
      return;
    }
    setIndex((current) => (current + 1) % videos.length);
  }

  const detailHref = isDefault
    ? "/etablissements"
    : `/etablissements/${active.schoolId}`;
  const detailLabel = isDefault
    ? "Découvrir les établissements →"
    : "Voir l'établissement →";

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-3xl bg-slate-950 text-white shadow-lg",
        className,
      )}
    >
      <video
        key={active.src}
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={active.src}
        muted
        playsInline
        autoPlay
        loop={videos.length === 1}
        preload="auto"
        onEnded={goNext}
        onError={goNext}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

      <div className="relative z-10 mt-auto flex flex-col gap-2 p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
          {isDefault ? "Klambocore" : "Pub établissements"}
        </p>
        <h3 className="text-lg font-black leading-tight sm:text-xl">
          {active.schoolName}
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={detailHref}
            className="text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
          >
            {detailLabel}
          </Link>
          {!isDefault && videos.length > 1 ? (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white/80">
              {index + 1} / {videos.length}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
