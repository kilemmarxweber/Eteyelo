"use client";

import { useState, useRef, useCallback } from "react";
import FiltersWrapper from "./FiltersWrapper";
import { StudentType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { IconChartBar, IconUsers } from "@tabler/icons-react";

export default function SidebarWithFilters({
  classOptions,
  data,
  role,
  students,
}: any) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [totalPercentage, setTotalPercentage] = useState("0.0");
  const [stats, setStats] = useState<any>(null);

  // ✅ STATE GLOBAL DU STUDENT
  const [selectedStudentId, setSelectedStudentId] = useState("");

  // ✅ trouver student sélectionné
  const selectedStudent = students.find(
    (s: StudentType) => s.studentid === selectedStudentId,
  );

  const displayStudent = selectedStudent ?? null;
  const studentClassName = displayStudent
    ? classOptions.find((c: any) => c.id === displayStudent.classid)?.name
    : "";

  const sendResults = async () => {
    // try {
    //   //if (!displayStudent) return;

    //   const classId = displayStudent.classid;

    //   const res = await fetch("/apis/send-results", {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       classId, // ✅ juste l'id
    //     }),
    //   });

    //   const data = await res.json();

    //   if (!res.ok) {
    //     console.error("API ERROR:", data);
    //     return;
    //   }

    //   console.log("SUCCESS:", data);
    // } catch (error) {
    //   console.error("FETCH ERROR:", error);
    // }

    try {
      const res = await fetch("/apis/send-whatsapp", {
        method: "POST",
      });

      const data = await res.json();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatsUpdate = useCallback((newStats: any) => {
    setStats(newStats);
  }, []);

  return (
    <>
      {/* ================= GAUCHE ================= */}
      <div className="w-full xl:w-2/3 rounded-md p-4 gap-4">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-lg font-semibold">
            {displayStudent ? (
              <>
                Notes pour{" "}
                {`${displayStudent.surname} ${displayStudent.nom} - ${
                  classOptions.find((c: any) => c.id === displayStudent.classid)
                    ?.name ?? ""
                }`}
              </>
            ) : (
              "Aucun élève sélectionné"
            )}
          </h1>
        </div>
        {/* TABLE / FILTER */}

        <div ref={tableRef}>
          <FiltersWrapper
            classOptions={classOptions}
            data={data}
            role={role}
            onTotalChange={setTotalPercentage}
            students={students}
            selectedStudentId={selectedStudentId}
            setSelectedStudentId={setSelectedStudentId}
            onStatsUpdate={handleStatsUpdate}
          />
        </div>
      </div>

      {/* ================= DROITE ================= */}
      <div className="w-full xl:w-1/4 flex flex-col mx-5 gap-4 text-sm p-4 rounded-md xl:sticky xl:top-4 h-fit">
        <div className="text-right font-semibold text-base">
          Total : {totalPercentage}%
        </div>

        <button className="w-full border p-2 rounded-md text-left hover:bg-gray-100 transition">
          ☑️ Afficher les notes hypothétiques sauvegardées
        </button>

        <button
          className="w-full border p-2 rounded-md hover:bg-gray-100 transition"
          onClick={sendResults}
        >
          Montrer tous les détails
        </button>

        <div className="border-t pt-3">
          <p className="font-medium mb-2">
            Les tâches du cours ne sont pas pondérées.
          </p>

          {stats && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Rapport de sélection
              </h3>

              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">
                  Sexe (M)
                </span>
                <div className="text-right">
                  <div className="font-semibold">
                    {stats.sexeStats.M.count} élèves
                  </div>
                  <div className="text-[10px] text-blue-500 font-medium">
                    Part: {stats.sexeStats.M.percent}% | Réussite:{" "}
                    {stats.sexeStats.M.successRate}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">
                  Sexe (F)
                </span>
                <div className="text-right">
                  <div className="font-semibold">
                    {stats.sexeStats.F.count} élèves
                  </div>
                  <div className="text-[10px] text-pink-500 font-medium">
                    Part: {stats.sexeStats.F.percent}% | Réussite:{" "}
                    {stats.sexeStats.F.successRate}%
                  </div>
                </div>
              </div>

              <div className="border-t dark:border-slate-800 pt-2 flex justify-between items-center">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Pourcentage Global
                </span>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    {stats.globalStats.avg}%
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {stats.globalStats.count} élèves au total
                  </div>
                </div>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" defaultChecked />
            Calcul basé uniquement sur les tâches notées
          </label>

          <p className="text-gray-500 text-sm">
            Vous pouvez simuler vos notes futures pour voir leur impact sur la
            moyenne.
          </p>
        </div>
      </div>
    </>
  );
}
