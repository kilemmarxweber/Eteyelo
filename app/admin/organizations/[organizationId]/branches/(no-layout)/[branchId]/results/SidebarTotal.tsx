"use client";

import { useState, useRef, useCallback } from "react";
import { IconFileTypePdf } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import { StudentType } from "@/lib/types";

import FiltersWrapper from "./FiltersWrapper";
import {
  exportResultsClassementReportPdf,
  type ClassementRow,
  type ResultsClassementReportOptions,
} from "./components/export-results-classement-pdf";
import { getResultsReportContextAction } from "./results.action";

export default function SidebarWithFilters({
  classOptions,
  data,
  role,
  students,
}: any) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [totalPercentage, setTotalPercentage] = useState("0.0");
  const [stats, setStats] = useState<any>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [classementRows, setClassementRows] = useState<ClassementRow[]>([]);
  const [reportOptions, setReportOptions] =
    useState<ResultsClassementReportOptions>({ classLabels: [] });

  // ✅ STATE GLOBAL DU STUDENT
  const [selectedStudentId, setSelectedStudentId] = useState("");

  // ✅ trouver student sélectionné
  const selectedStudent = students.find(
    (s: StudentType) => s.studentid === selectedStudentId,
  );

  const displayStudent = selectedStudent ?? null;
  const hasClassement = classementRows.length > 0;

  const sendResults = async () => {
    try {
      const res = await fetch("/apis/send-whatsapp", {
        method: "POST",
      });

      await res.json();
    } catch (err) {
      console.error(err);
    }
  };

  const exportClassementPdf = async () => {
    if (!hasClassement) {
      toast.error(
        "Aucun résultat à exporter pour cette sélection. Choisissez une classe avec des notes.",
      );
      return;
    }

    setExportingPdf(true);
    try {
      const [context, error] = await getResultsReportContextAction();
      if (error || !context) {
        throw new Error(
          error?.message ||
            "Impossible de charger les informations du rapport.",
        );
      }
      await exportResultsClassementReportPdf(
        classementRows,
        context,
        reportOptions,
      );
      toast.success("Le classement PDF a été généré.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de générer le classement PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const handleStatsUpdate = useCallback((newStats: any) => {
    setStats((prev: any) => {
      if (
        prev &&
        prev.sexeStats?.M?.count === newStats?.sexeStats?.M?.count &&
        prev.sexeStats?.F?.count === newStats?.sexeStats?.F?.count &&
        prev.sexeStats?.M?.percent === newStats?.sexeStats?.M?.percent &&
        prev.sexeStats?.F?.percent === newStats?.sexeStats?.F?.percent &&
        prev.sexeStats?.M?.successRate ===
          newStats?.sexeStats?.M?.successRate &&
        prev.sexeStats?.F?.successRate ===
          newStats?.sexeStats?.F?.successRate &&
        prev.globalStats?.avg === newStats?.globalStats?.avg &&
        prev.globalStats?.count === newStats?.globalStats?.count
      ) {
        return prev;
      }
      return newStats;
    });
  }, []);

  const handleClassementUpdate = useCallback(
    (payload: {
      classementRows: ClassementRow[];
      reportOptions: ResultsClassementReportOptions;
    }) => {
      setClassementRows(payload.classementRows);
      setReportOptions(payload.reportOptions);
    },
    [],
  );

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
            onClassementUpdate={handleClassementUpdate}
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

        <div className="flex flex-col gap-2">
          <button
            className="w-full border p-2 rounded-md hover:bg-gray-100 transition"
            onClick={sendResults}
          >
            Montrer tous les détails
          </button>
          <Button
            variant="outline"
            className="w-full"
            leftSection={<IconFileTypePdf size={16} />}
            onClick={exportClassementPdf}
            loading={exportingPdf}
            disabled={!hasClassement || exportingPdf}
            title={
              hasClassement
                ? "Exporter le classement PDF"
                : "Aucun résultat pour cette sélection"
            }
          >
            {exportingPdf ? "Génération..." : "Classement PDF"}
          </Button>
        </div>

        <div className="border-t pt-3">
          <p className="font-medium mb-2">
            Les tâches du cours ne sont pas pondérées.
          </p>

          {stats && (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Rapport de sélection
              </h3>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Sexe (M)</span>
                <div className="text-right">
                  <div className="font-semibold text-foreground">
                    {stats.sexeStats.M.count} élèves
                  </div>
                  <div className="text-[10px] font-medium text-blue-500 dark:text-blue-400">
                    Part: {stats.sexeStats.M.percent}% | Réussite:{" "}
                    {stats.sexeStats.M.successRate}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Sexe (F)</span>
                <div className="text-right">
                  <div className="font-semibold text-foreground">
                    {stats.sexeStats.F.count} élèves
                  </div>
                  <div className="text-[10px] font-medium text-pink-500 dark:text-pink-400">
                    Part: {stats.sexeStats.F.percent}% | Réussite:{" "}
                    {stats.sexeStats.F.successRate}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium text-foreground">
                  Pourcentage Global
                </span>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    {stats.globalStats.avg}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">
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

          <p className="text-sm text-muted-foreground">
            Vous pouvez simuler vos notes futures pour voir leur impact sur la
            moyenne.
          </p>
        </div>
      </div>
    </>
  );
}
