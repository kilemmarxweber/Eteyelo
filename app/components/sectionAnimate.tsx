"use client";

import { useEffect, useState } from "react";
import { Sparkles, Search, ArrowRight } from "lucide-react";

function AnimatedBackground({ stars, squares, mouse, active }: any) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white" />

      {/* STARS */}
      <div className="stars">
        {stars.map((s: any, i: number) => {
          const dx = active ? (mouse.x - s.left * 10) * 0.02 : 0;
          const dy = active ? (mouse.y - s.top * 10) * 0.02 : 0;

          return (
            <span
              key={i}
              className="star"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                transform: `translate(${dx}px, ${dy}px)`,
                animationDuration: `${s.duration}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          );
        })}
      </div>

      {/* SQUARES */}
      <div className="floating-squares">
        {squares.map((s: any, i: number) => {
          const dx = active ? (mouse.x - s.left * 10) * 0.03 : 0;
          const dy = active ? (mouse.y - s.top * 10) * 0.03 : 0;

          return (
            <span
              key={i}
              className="square"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                transform: `translate(${dx}px, ${dy}px)`,
                animationDuration: `${s.duration}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function HeroSection({
  search,
  setSearch,
  cities,
  cityFilter,
  setCityFilter,
}: any) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const [stars, setStars] = useState<any[]>([]);
  const [squares, setSquares] = useState<any[]>([]);

  // FIX HYDRATION → generate AFTER mount
  useEffect(() => {
    setMounted(true);

    setStars(
      Array.from({ length: 40 }).map(() => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: 3 + Math.random() * 5,
        delay: Math.random() * 5,
      })),
    );

    setSquares(
      Array.from({ length: 20 }).map(() => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 4 + Math.random() * 10,
        duration: 6 + Math.random() * 6,
        delay: Math.random() * 5,
      })),
    );
  }, []);

  return (
    <section
      className="relative mx-auto max-w-6xl px-4 text-center overflow-hidden py-16"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMouse({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }}
    >
      {mounted && (
        <AnimatedBackground
          stars={stars}
          squares={squares}
          mouse={mouse}
          active={active}
        />
      )}

      {/* CONTENT */}
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs shadow-sm">
          <Sparkles className="size-4 text-blue-600" />
          Plateforme SaaS de marketing scolaire
        </div>

        <h1 className="mt-5 text-4xl font-black">
          Trouvez les meilleurs{" "}
          <span className="text-blue-600">établissements</span>
        </h1>

        <p className="mt-3 text-gray-500">
          Écoles, universités et instituts en RDC
        </p>

        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          <button className="rounded-2xl px-6 h-11 w-full sm:w-auto bg-blue-600 text-white">
            Voir établissements <ArrowRight className="ml-2 inline size-4" />
          </button>

          <button className="rounded-2xl px-6 h-11 w-full sm:w-auto border">
            Inscrire une école
          </button>
        </div>

        <div className="mt-6 mx-auto w-full max-w-[800px] px-4">
          <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm">
            <Search className="size-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm h-8 outline-none"
              placeholder="Rechercher..."
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2 justify-center">
          {cities.map((city: string) => (
            <button
              key={city}
              onClick={() => setCityFilter(city)}
              className={`px-4 py-1 rounded-full text-sm border ${
                cityFilter === city ? "bg-blue-600 text-white" : "bg-white"
              }`}
            >
              {city}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
