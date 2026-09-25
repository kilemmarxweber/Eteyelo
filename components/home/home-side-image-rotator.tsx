"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

type HomeSideImageRotatorProps = {
  images: string[];
  intervalMs?: number;
  className?: string;
  emptyLabel?: string;
};

/** Rotation fiable des photos latérales (événements / établissements). */
export function HomeSideImageRotator({
  images,
  intervalMs = 6000,
  className,
  emptyLabel = "Photos des établissements et événements à venir",
}: HomeSideImageRotatorProps) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (images.length <= 1) return;

    const timer = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % images.length);
        setFading(false);
      }, 350);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [images.length, intervalMs]);

  if (images.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center bg-gradient-to-br from-blue-950 to-cyan-700 p-6 text-center text-sm font-semibold text-white/80",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {images.map((src, imageIndex) => {
        const isActive = imageIndex === index;
        return (
          <div
            key={`${src}-${imageIndex}`}
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              isActive && !fading ? "opacity-100" : "opacity-0",
            )}
          >
            <Image
              src={src}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 40vw"
              unoptimized
              priority={imageIndex === 0}
            />
          </div>
        );
      })}
    </div>
  );
}
