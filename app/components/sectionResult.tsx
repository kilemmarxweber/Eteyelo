"use client";

import { useMemo, useState, useEffect } from "react";

const studentsData = [
  { name: "Jean Paul", school: "UNIKIN", class: "L2 Info", score: 89 },
  { name: "Marie Claire", school: "Boboto", class: "6e", score: 76 },
  { name: "Kevin", school: "Saint Joseph", class: "L1 Math", score: 92 },
  { name: "Aline", school: "UNIKIN", class: "L3 Info", score: 81 },
  { name: "David", school: "Boboto", class: "5e", score: 70 },
  { name: "Sarah", school: "Saint Joseph", class: "L2 Math", score: 95 },
];

const ITEMS_PER_PAGE = 3;

export default function StudentsSection() {
  const [page, setPage] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const [schoolFilter, setSchoolFilter] = useState("Tous");
  const [classFilter, setClassFilter] = useState("Tous");

  // LISTES FILTRES
  const schools = ["Tous", ...new Set(studentsData.map((s) => s.school))];
  const classes = ["Tous", ...new Set(studentsData.map((s) => s.class))];

  const filtered = useMemo(() => {
    return studentsData.filter((s) => {
      const matchSchool =
        schoolFilter === "Tous" || s.school === schoolFilter;

      const matchClass =
        classFilter === "Tous" || s.class === classFilter;

      return matchSchool && matchClass;
    });
  }, [schoolFilter, classFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const paginated = useMemo(() => {
    const start = page * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  // RESET PAGE si filtre change
  useEffect(() => {
    setPage(0);
  }, [schoolFilter, classFilter]);

  // AUTO PAGINATION
  useEffect(() => {
    if (!autoPlay || totalPages <= 1) return;

    const interval = setInterval(() => {
      setPage((prev) => (prev + 1) % totalPages);
    }, 4000);

    return () => clearInterval(interval);
  }, [autoPlay, totalPages]);

  return (
    <section className="mx-auto max-w-6xl px-4 mt-20 mb-20">
      <h2 className="text-2xl font-bold mb-4">
        Classements des élèves
      </h2>

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <select
          className="border rounded-xl px-3 py-2"
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
        >
          {schools.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select
          className="border rounded-xl px-3 py-2"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          {classes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <button
          onClick={() => setAutoPlay((v) => !v)}
          className={`px-4 py-2 rounded-xl border ${
            autoPlay ? "bg-green-600 text-white" : "bg-white"
          }`}
        >
          Auto pagination: {autoPlay ? "ON" : "OFF"}
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-3xl overflow-hidden">
        <div className="grid grid-cols-4 bg-gray-50 p-4 text-sm font-semibold">
          <div>Élève</div>
          <div>École</div>
          <div>Classe</div>
          <div>Performance</div>
        </div>

        {paginated.map((s) => (
          <div
            key={s.name}
            className="grid grid-cols-4 p-4 border-t text-sm"
          >
            <div className="font-medium">{s.name}</div>
            <div className="text-gray-600">{s.school}</div>
            <div className="text-gray-600">{s.class}</div>

            <div className="flex items-center gap-2">
              <div className="w-full h-2 bg-gray-100 rounded-full">
                <div
                  className="h-2 bg-purple-600 rounded-full"
                  style={{ width: `${s.score}%` }}
                />
              </div>
              <span className="text-xs">{s.score}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* PAGINATION CONTROLS */}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setPage(i);
              setAutoPlay(false); // switch en manuel
            }}
            className={`w-8 h-8 rounded-lg border text-sm ${
              page === i ? "bg-purple-600 text-white" : "bg-white"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </section>
  );
}