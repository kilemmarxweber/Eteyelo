"use client";

import { useState, useEffect } from "react";
import { getAttendanceHistory } from "../attendance.action";
import { columns } from "./columns";
import { ResponsiveDataTable } from "@/components/custom";
import { DataTableToolbar } from "./data-table-toolbar";
import { AttendanceSessionRow } from "../interface/Attendance";

import PersonnelAttendanceForm from "./PersonnelAttendanceForm";
import TeacherAttendanceForm from "./TeacherAttendanceForm";
import { Card } from "@/components/ui/card";

export default function AttendanceList() {
  const [data, setData] = useState<AttendanceSessionRow[]>([]);
  const [open, setOpen] = useState(false);

  const [type, setType] = useState<"student" | "teacher" | "personnel" | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      const [res, err] = await getAttendanceHistory();
      if (err) return;

      setData(
        (res || []).map((item: any) => ({
          ...item,
          type: item.type?.toLowerCase(),
          date: new Date(item.date).toISOString(), // 🔥 FIX ICI
        })),
      );
    })();
  }, []);

  function closeModal() {
    setOpen(false);
    setType(null);
  }

  return (
    <>
      <Card className="border-0 shadow-sm">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-lg">Historique des présences</h2>

          <p className="text-sm text-muted-foreground">Sessions enregistrées</p>
        </div>

        <ResponsiveDataTable
          columns={columns}
          data={data}
          ToolbarComponent={(props) => (
            <DataTableToolbar {...props} onAdd={() => setOpen(true)} />
          )}
          emptyText="Aucune session"
          mobileCardTitle={(row) => row.cours ?? "Session"}
          mobileCardSubtitle={(row) => row.classe ?? ""}
        />
      </Card>
      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="w-[95%] sm:w-[90%] md:w-[70%] lg:w-[520px] max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl p-4 sm:p-6">
            {/* HEADER */}
            <div className="mb-5">
              <h2 className="text-base sm:text-lg font-semibold">
                {type
                  ? "Enregistrement de présence"
                  : "Choisir le type de présence"}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {type
                  ? "Remplissez les informations"
                  : "Sélectionnez le type d’enregistrement"}
              </p>
            </div>

            {/* STEP 1 - SELECT TYPE */}
            {!type && (
              <div className="space-y-3">
                <button
                  onClick={() => setType("student")}
                  className="w-full flex items-start gap-3 rounded-lg border p-3 sm:p-4 text-left hover:bg-muted transition"
                >
                  <span className="text-xl">👨‍🎓</span>
                  <div>
                    <p className="font-medium text-sm sm:text-base">Student</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Présence des étudiants
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setType("teacher")}
                  className="w-full flex items-start gap-3 rounded-lg border p-3 sm:p-4 text-left hover:bg-muted transition"
                >
                  <span className="text-xl">👨‍🏫</span>
                  <div>
                    <p className="font-medium text-sm sm:text-base">Teacher</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Présence des enseignants
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setType("personnel")}
                  className="w-full flex items-start gap-3 rounded-lg border p-3 sm:p-4 text-left hover:bg-muted transition"
                >
                  <span className="text-xl">👔</span>
                  <div>
                    <p className="font-medium text-sm sm:text-base">
                      Personnel
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Présence du personnel administratif
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* STEP 2 - FORMS */}
            {type === "teacher" && (
              <TeacherAttendanceForm
                onSuccess={closeModal}
                sessionData={{
                  teacherId: "",
                  teachingId: "",
                  cours: "",
                  classe: "",
                  branch: {
                    id: "",
                    name: "",
                  },
                }}
              />
            )}

            {type === "personnel" && (
              <PersonnelAttendanceForm onSuccess={closeModal} />
            )}

            {type === "student" && (
              <div className="text-sm text-muted-foreground">
                Formulaire étudiant à implémenter
              </div>
            )}

            {/* FOOTER */}
            <div className="mt-5 flex justify-between">
              {type ? (
                <button
                  onClick={() => setType(null)}
                  className="text-xs sm:text-sm text-muted-foreground hover:text-black"
                >
                  Retour
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={closeModal}
                className="text-xs sm:text-sm text-muted-foreground hover:text-black"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
