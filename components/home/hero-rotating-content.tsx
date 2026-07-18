"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  CheckCircle2,
  GraduationCap,
  School,
  Users,
} from "lucide-react";

import { AnimatedCounter } from "@/components/animated-counter";
import type { HomeStatsSegment } from "@/lib/home/home-data";
import { pluralizeLabel } from "@/lib/people-labels";

const SEGMENT_ICONS = {
  schools: School,
  centres: Building2,
  universities: GraduationCap,
} as const;

type HeroRotatingContentProps = {
  segments: HomeStatsSegment[];
  verified: number;
  intervalMs?: number;
  children?: ReactNode;
};

function transitionClass(isTransitioning: boolean) {
  return isTransitioning
    ? "translate-y-2 opacity-0"
    : "translate-y-0 opacity-100";
}

export function HeroRotatingContent({
  segments,
  verified,
  intervalMs = 5000,
  children,
}: HeroRotatingContentProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (segments.length <= 1) {
      return;
    }

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
  const SegmentIcon = SEGMENT_ICONS[segment.key];

  return (
    <>
      <h2
        className={`text-4xl font-black leading-tight text-white transition-all duration-300 sm:text-5xl md:text-6xl ${transitionClass(isTransitioning)}`}
      >
        {segment.heroTitleBefore}{" "}
        <span className="text-xl text-yellow-300 sm:text-2xl md:text-3xl">
          Afrique
        </span>
      </h2>

      <p
        className={`mx-auto mt-4 w-full text-base leading-7 text-blue-50 transition-all duration-300 sm:w-[36rem] sm:text-lg lg:mx-0 ${transitionClass(isTransitioning)}`}
      >
        {segment.heroSubtitle}
      </p>

      {children}

      <div className="mx-auto mt-7 w-full sm:w-[36rem] lg:mx-0">
        <div className="mb-3 flex justify-center lg:justify-start">
          <div
            className={`inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur transition-all duration-300 ${transitionClass(isTransitioning)}`}
          >
            <SegmentIcon className="size-4" />
            {segment.title}
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-3">
          {[
            {
              label: segment.countLabel,
              value: segment.count,
              suffix: "+",
              icon: SegmentIcon,
              iconClassName: "bg-blue-100 text-blue-700",
              animate: true,
            },
            {
              label: pluralizeLabel(
                segment.peopleLabelSingular,
                segment.peopleLabelPlural,
                segment.people,
              ),
              value: segment.people,
              suffix: "+",
              icon: Users,
              iconClassName: "bg-cyan-100 text-cyan-700",
              animate: true,
            },
            {
              label: "Vérifié",
              value: verified,
              suffix: "%",
              icon: CheckCircle2,
              iconClassName: "bg-emerald-100 text-emerald-600",
              animate: false,
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="flex min-h-20 items-center gap-3 rounded-2xl border border-white/15 bg-white/15 px-4 py-3 text-left backdrop-blur"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${stat.iconClassName}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p
                    className={`text-2xl font-black leading-none transition-all duration-300 sm:text-3xl ${
                      stat.animate && isTransitioning
                        ? "translate-y-2 opacity-0"
                        : "translate-y-0 opacity-100"
                    }`}
                  >
                    {stat.animate ? (
                      <AnimatedCounter
                        end={stat.value}
                        suffix={stat.suffix}
                        animationKey={`${segment.key}-${stat.value}`}
                      />
                    ) : (
                      <>
                        {stat.value}
                        {stat.suffix}
                      </>
                    )}
                  </p>

                  <p
                    className={`mt-1 truncate text-sm leading-tight text-blue-50 transition-all duration-300 ${
                      stat.animate && isTransitioning
                        ? "translate-y-1 opacity-0"
                        : "translate-y-0 opacity-100"
                    }`}
                  >
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
