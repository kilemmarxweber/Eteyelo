"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, School, Trophy } from "lucide-react";

export type StudentRanking = {
  id: string;
  name: string;
  school: string;
  className: string;
  score: number;
};

const ITEMS_PER_PAGE = 3;

type StudentsSectionProps = {
  rankings: StudentRanking[];
};

export default function StudentsSection({ rankings }: StudentsSectionProps) {
  const [page, setPage] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [schoolFilter, setSchoolFilter] = useState("Tous");
  const [classFilter, setClassFilter] = useState("Tous");

  const schools = ["Tous", ...new Set(rankings.map((s) => s.school))];
  const classes = ["Tous", ...new Set(rankings.map((s) => s.className))];

  const filtered = useMemo(() => {
    return rankings.filter((s) => {
      const matchSchool = schoolFilter === "Tous" || s.school === schoolFilter;
      const matchClass = classFilter === "Tous" || s.className === classFilter;

      return matchSchool && matchClass;
    });
  }, [rankings, schoolFilter, classFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const paginated = useMemo(() => {
    const start = page * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(0);
  }, [schoolFilter, classFilter]);

  useEffect(() => {
    if (!autoPlay || totalPages <= 1) return;

    const interval = setInterval(() => {
      setPage((prev) => (prev + 1) % totalPages);
    }, 4000);

    return () => clearInterval(interval);
  }, [autoPlay, totalPages]);

  return (
    <section className="mx-auto mb-20 mt-20 max-w-6xl px-4">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-950">
            Résultats
          </p>
          <h2 className="text-2xl font-bold">Classements des élèves</h2>
        </div>

        <button
          onClick={() => setAutoPlay((v) => !v)}
          className={`inline-flex w-fit items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
            autoPlay
              ? "border-blue-950 bg-blue-950 text-white"
              : "border-gray-200 bg-white text-gray-700 hover:border-blue-950/30 hover:text-blue-950"
          }`}
        >
          {autoPlay ? <Pause className="size-4" /> : <Play className="size-4" />}
          Auto pagination: {autoPlay ? "ON" : "OFF"}
        </button>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <select
          className="h-11 rounded-xl border bg-white px-3 text-sm"
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
        >
          {schools.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select
          className="h-11 rounded-xl border bg-white px-3 text-sm"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          {classes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {paginated.length ? (
          paginated.map((s, index) => (
            <article
              key={s.id}
              className="group grid gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-950/30 hover:shadow-lg hover:shadow-blue-950/10 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_minmax(190px,280px)] lg:items-center"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-950/10 text-blue-950">
                  <span className="text-sm font-black">
                    #{page * ITEMS_PER_PAGE + index + 1}
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-gray-950">
                    {s.name}
                  </h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                    <School className="size-4 shrink-0 text-blue-950" />
                    <span className="truncate">{s.school}</span>
                  </p>
                </div>
              </div>

              <div className="inline-flex w-fit items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 sm:justify-self-end lg:justify-self-start">
                {s.className}
              </div>

              <div className="w-full sm:col-span-2 lg:col-span-1">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-gray-500">
                  <span className="flex min-w-0 items-center gap-1">
                    <Trophy className="size-4 shrink-0 text-blue-950" />
                    <span className="truncate">Performance</span>
                  </span>
                  <span className="shrink-0 font-bold text-blue-950">
                    {s.score}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-950 transition-all duration-500"
                    style={{ width: `${s.score}%` }}
                  />
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-gray-500">
            Aucun classement disponible pour le moment.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setPage(i);
                setAutoPlay(false);
              }}
              className={`h-8 w-8 rounded-lg border text-sm transition ${
                page === i
                  ? "border-blue-950 bg-blue-950 text-white"
                  : "bg-white hover:border-blue-950/30 hover:text-blue-950"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
