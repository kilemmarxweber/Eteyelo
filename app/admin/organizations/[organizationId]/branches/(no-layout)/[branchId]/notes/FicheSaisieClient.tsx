"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

import { lessonColumns } from "./components/columns";
import * as XLSX from "xlsx";
import { FaFileExcel } from "react-icons/fa";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combox";
import { ExcelRow, FicheTypes, Period, Teacher } from "./components/types";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { Button } from "@/components/custom/button";
import { IconNotes } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { StudentRow } from "./components/types";
import { CircleFadingArrowUpIcon } from "lucide-react";
import { ResponsiveDataTable } from "@/components/custom";
import { notesColumns } from "./components/notes.columns";
import { NotesToolbar } from "./components/notes.toolbar";
import { useRouter } from "next/navigation";
import {
  checkExistingFiche,
  createFiche,
  getPeriods,
  getSchoolYear,
  getStudentsByClass,
} from "./note.action";

/* ===== DYNAMIC ===== */
const TeacherCombobox = dynamic(
  () =>
    import("@/components/ui/TeacherCombobox").then((m) => m.TeacherCombobox),
  { ssr: false },
);

/* ===== COMPONENT ===== */
export default function FicheSaisieClient({
  teachers,
  isAdmin,
}: {
  teachers: Teacher[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(
    !isAdmin && teachers.length > 0 ? teachers[0].id : null,
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [ficheOption, setFicheOption] = useState<"global" | "cumule" | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [typeFiche, setTypeFiche] = useState<FicheTypes | null>(null);

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const filled = students.filter((s) => s.score !== null).length;
  const percentage = students.length > 0 ? (filled / students.length) * 100 : 0;
  /* ===== LOAD PERIODS ===== */

  useEffect(() => {
    getPeriods().then(setPeriods);
  }, []);
  const isExamPeriod = (period?: Period | null) =>
    period?.label === "Exam 1st semester" ||
    period?.label === "Exam 2nd semester";
  /* ===== LOAD STUDENTS ===== */
  useEffect(() => {
    let ignore = false;

    async function loadStudents() {
      // 🔥 reset si filtres incomplets
      if (
        !selectedTeacherId ||
        !selectedLessonId ||
        !selectedPeriodId ||
        !typeFiche ||
        !selectedYearId
      ) {
        setStudents([]);
        return;
      }

      const lesson = selectedTeacher?.lessons.find(
        (l) => l.id === selectedLessonId,
      );

      const period = periods.find((p) => p.id === selectedPeriodId);

      if (!lesson || !period) {
        setStudents([]);
        return;
      }

      if (isExamPeriod(period) && typeFiche !== "ficheCote") {
        setTypeFiche("ficheCote"); // UI sync
      }
      // 🔥 LOCK CHECK IMMÉDIAT (avant fetch)
      if (isLocked(lesson)) {
        setStudents([]);
        return;
      }

      const studentsFromServer = (await getStudentsByClass(
        lesson.classId,
        selectedYearId,
      )) as any[];
      if (ignore) return;

      // 🔥 si lock apparaît pendant async → clean
      if (isLocked(lesson)) {
        setStudents([]);
        return;
      }

      if (!studentsFromServer?.length) {
        setStudents([]);
        return;
      }

      const isStandardType = ["Evaluation", "Devoir", "TP"].includes(typeFiche);
      const isExam = period.label.startsWith("Exam");
      const isFicheCote = typeFiche === "ficheCote";

      let finalMaxScore = lesson.maxScore;

      if (isStandardType) {
        finalMaxScore = 10;
      } else if (isExam) {
        finalMaxScore = lesson.maxScore * 2;
      } else if (isFicheCote) {
        finalMaxScore = lesson.maxScore;
      }

      let initialStudents: StudentRow[] = studentsFromServer
        .filter((s): s is any & { studentId: string } => !!s.studentId)
        .map((s) => ({
          studentId: s.studentId,
          name: s.name ?? "",
          surname: s.surname ?? "",
          firstname: s.firstname ?? "",
          lastname: s.lastname ?? "",
          daten: s.birthday ? new Date(s.birthday) : new Date(),
          codestudent: "",
          classname: s.classname ?? "",
          sex: s.sex ?? "Male",
          score: null,
          maxScore: finalMaxScore,
          _scoreInput: "",
        }));

      const existingFiche = await checkExistingFiche({
        teacherId: selectedTeacherId!,
        classId: lesson.classId,
        lessonId: selectedLessonId,
        periodId: selectedPeriodId,
        anneeId: selectedYearId!,
        typeFiche,
      });

      if (ignore) return;

      // 🔥 re-check lock après DB call
      if (isLocked(lesson)) {
        setStudents([]);
        return;
      }

      if (
        existingFiche.exists &&
        existingFiche.data &&
        typeFiche === "ficheCote"
      ) {
        const notes = existingFiche.data.notes;

        initialStudents = initialStudents.map((s) => {
          const found = notes.find((n: any) => n.studentId === s.studentId);
          return {
            ...s,
            score: found ? found.score : null,
          };
        });
      }

      setStudents(initialStudents);
    }

    loadStudents();

    return () => {
      ignore = true;
    };
  }, [
    selectedTeacherId,
    selectedLessonId,
    selectedPeriodId,
    typeFiche,
    selectedYearId,
    periods,
  ]);

  useEffect(() => {
    setStudents([]);
  }, [typeFiche]);
  useEffect(() => {
    getSchoolYear().then((current) => {
      setSchoolYears([current]); // ou si tu as getAllSchoolYears()
      setSelectedYearId(current?.id ?? null);
    });
  }, []);
  /* ====-- RESET FORM ON TEACHER CHANGE ===== */
  const resetForm = () => {
    setSelectedLessonId(null);
    setSelectedPeriodId(null);
    setStudents([]);
    setTypeFiche(null);
    setFicheOption(null);
    // 🔥 recharge les données serveur (teachers inclus)
    router.refresh();
    // 👉 sélectionner le premier teacher disponible
    if (filteredTeachers.length > 0) {
      setSelectedTeacherId(filteredTeachers[0].id);
    }
  };
  /* ===== SUBMIT ===== */
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsLoading(true);
    setIsSubmitting(true);

    const missingFields: string[] = [];

    if (!selectedTeacherId) missingFields.push("Enseignant");
    if (!selectedLessonId) missingFields.push("Leçon");
    if (!selectedPeriodId) missingFields.push("Périodicité");
    if (!typeFiche) missingFields.push("Type de fiche");

    if (missingFields.length > 0) {
      toast.error(`Veuillez remplir : ${missingFields.join(", ")}`);
      setIsSubmitting(false);
      return;
    }

    try {
      const schoolYear = schoolYears.find((y) => y.id === selectedYearId);
      if (!schoolYear) {
        toast.error("Année scolaire non sélectionnée");
        return;
      }
      const lesson = selectedTeacher?.lessons.find(
        (l) => l.id === selectedLessonId!,
      );

      if (!lesson || isLocked(lesson)) {
        setStudents([]);
        return;
      }
      const period = periods.find((p) => p.id === selectedPeriodId!);

      if (!lesson || !period || !schoolYear) {
        toast.error("Données invalides");
        return;
      }

      const notesFormatted = students.map((s) => ({
        studentId: s.studentId,
        nom: s.name,
        studentSurname: s.lastname,
        studentusername: s.firstname,
        studentnaissance: s.daten,
        studentclasse: s.classname,
        codestudent: s.codestudent,
        application: s.application ?? "B",
        comment: s.comment ?? "",
        studentSexe: s.sex === "Male" ? "M" : "F",
        score: s.score === null ? null : Number(s.score),
        maxScore: s.maxScore,
      }));

      const result = await createFiche({
        teacherId: selectedTeacherId!,
        classId: lesson.classId,
        lessonId: lesson.id,
        subjectName: lesson.subjectName,
        className: lesson.className,
        periodId: period.id,
        periodName: period.label,
        anneeId: schoolYear.id,
        anneeName: schoolYear.nameYear,
        schoolYearId: schoolYear.id,
        typeFiche: typeFiche!,
        ficheOption: ficheOption ?? "global",
        notes: notesFormatted,
        autres: [],
      });

      if (!result.success) {
        toast.error(result.message ?? "Erreur lors de la création");
        return;
      }

      toast.success("Fiche créée/mise à jour avec succès");
      resetForm();
      setStudents((prev) => prev.map((s) => ({ ...s, score: 0 })));
    } catch (error) {
      console.error(error);
      toast.error("Erreur serveur ❌");
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };
  /* ===== EXPORT TO EXCEL ===== */
  const handleExport = () => {
    if (!selectedTeacher || !selectedLessonId || !selectedPeriodId) return;
    const lesson = selectedTeacher.lessons.find(
      (l) => l.id === selectedLessonId,
    );
    const period = periods.find((p) => p.id === selectedPeriodId);
    if (!lesson || !period) return;

    const wb = XLSX.utils.book_new();

    // Méta : classe, période, cours
    const meta = [
      ["Classe:", lesson.className],
      ["Période:", period.label],
      ["Cours:", lesson.subjectName],
      [],
    ];

    const ws = XLSX.utils.aoa_to_sheet(meta);

    // Ajouter l'entête avec style
    const header = [
      "ID",
      "Nom",
      "Prénom",
      "Lastname",
      "Sexe",
      "Score",
      "MaxScore",
    ];
    XLSX.utils.sheet_add_aoa(ws, [header], { origin: meta.length });

    // Ajouter les données avec Score en number
    const data = students.map((s) => [
      s.studentId,
      s.name,
      s.firstname,
      s.lastname,
      s.sex,
      s.score ?? 0,
      s.maxScore,
    ]);

    XLSX.utils.sheet_add_aoa(ws, data, { origin: meta.length + 1 });

    // Style simple : colorer l'entête
    header.forEach((_, col) => {
      const cellRef = XLSX.utils.encode_cell({ r: meta.length, c: col });
      if (!ws[cellRef]) return;
      ws[cellRef].s = {
        fill: { fgColor: { rgb: "FFD700" } }, // jaune
        font: { bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center" },
      };
    });

    XLSX.utils.book_append_sheet(wb, ws, "Eleves");
    XLSX.writeFile(
      wb,
      `${lesson.className}_${lesson.subjectName}_${period.label}.xlsx`,
    );
  };

  /* ===== IMPORT FROM EXCEL ===== */
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Ignore les 4 premières lignes (méta)
      //const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { range: 4 });
      const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { range: 4 });
      const newStudents: StudentRow[] = jsonData.map((s: any) => ({
        studentId: s.ID ?? "", // ou mieux: filtrer si vide
        name: s.Nom ?? "",
        surname: s.surname ?? "",
        firstname: s.Prénom ?? "",
        lastname: s.Lastname ?? "",
        sex: s.Sexe === "F" ? "Female" : "Male",
        daten: s.Daten ? new Date(s.Daten) : new Date(),
        classname: s.Classname ?? "",
        codestudent: s.Codestudent ?? "",
        score: s.Score ?? null,
        maxScore: s.MaxScore ?? 0,
      }));

      setStudents(newStudents);
      toast.success("Import réussi !");
    };
    reader.readAsBinaryString(file);
  };
  const filteredTeachers: Teacher[] = teachers.filter(
    (t) => t.lessons && t.lessons.length > 0,
  );
  const period = periods.find((p) => p.id === selectedPeriodId);
  const isExam = isExamPeriod(period);
  const canFilter = Boolean(selectedPeriodId && typeFiche && selectedYearId);
  const isLocked = (l: any) =>
    canFilter &&
    l.fiches?.some((f: any) => {
      if (!f.status) return false;

      const sameContext =
        f.periodId === selectedPeriodId && f.anneeId === selectedYearId;

      return (
        sameContext &&
        (f.typeFiche === "ficheCote" || f.typeFiche === typeFiche)
      );
    });
  const columns = React.useMemo(
    () =>
      notesColumns(
        (id, value) =>
          setStudents((prev) =>
            prev.map((s) => (s.studentId === id ? { ...s, score: value } : s)),
          ),

        (id, value) =>
          setStudents((prev) =>
            prev.map((s) =>
              s.studentId === id
                ? { ...s, application: value || undefined }
                : s,
            ),
          ),

        (id, value) =>
          setStudents((prev) =>
            prev.map((s) =>
              s.studentId === id ? { ...s, comment: value } : s,
            ),
          ),
      ),
    [], // 🔥 IMPORTANT
  );
  /* ===== RENDER ===== */
  return (
    <Layout>
      <LayoutBody className="space-y-6">
        {/* ===== HEADER ===== */}
        <PageHeader
          title="Gestion des notes"
          description="Gérer les notes des élèves"
          badge={
            <Badge variant="outline-primary" icon={<IconNotes size={14} />}>
              Notes
            </Badge>
          }
        />
        <Card
          variant="elevated"
          padding="none"
          className="animate-fade-in p-6 space-y-6"
        >
          {/* ===== FILTRES + ACTIONS ===== */}
          <div className="p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* LEFT */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              {isAdmin && (
                <TeacherCombobox
                  teachers={filteredTeachers}
                  value={selectedTeacherId}
                  onChange={(id) => {
                    setSelectedTeacherId(id);
                    setSelectedLessonId(null);
                    setStudents([]);
                  }}
                />
              )}
              <Combobox
                placeholder="Année scolaire"
                items={schoolYears.map((y) => ({
                  value: y.id,
                  label: y.nameYear,
                  search: y.nameYear,
                }))}
                value={selectedYearId ?? ""}
                onChange={(value) => setSelectedYearId(value || null)}
                width={240}
              />
              {(() => {
                const periodOrder = [
                  "1st Period",
                  "2nd Period",
                  "Exam 1st semester",
                  "3tr Period",
                  "4th Period",
                  "Exam 2nd semester",
                ];

                const orderedPeriods = periodOrder
                  .map((label) => periods.find((p) => p.label === label))
                  .filter((p): p is Period => Boolean(p))
                  .filter((p) => {
                    if (isAdmin) return true;

                    return (
                      p.label !== "Exam 1st semester" &&
                      p.label !== "Exam 2nd semester"
                    );
                  });
                return (
                  <Combobox
                    placeholder="Choisir une période"
                    items={orderedPeriods.map((p) => ({
                      value: String(p.id),
                      label: p.label,
                      search: p.label,
                    }))}
                    value={selectedPeriodId ? String(selectedPeriodId) : ""}
                    onChange={(value) =>
                      setSelectedPeriodId(value ? Number(value) : null)
                    }
                    width={240}
                  />
                );
              })()}

              <Combobox
                placeholder="Choisir une fiche"
                items={
                  isAdmin
                    ? isExam
                      ? [{ value: "ficheCote", label: "Fiche" }]
                      : [
                          { value: "Devoir", label: "Devoir" },
                          { value: "Evaluation", label: "Evaluation" },
                          { value: "TP", label: "TP" },
                          { value: "ficheCote", label: "Fiche" },
                        ]
                    : [
                        { value: "Devoir", label: "Devoir" },
                        { value: "Evaluation", label: "Evaluation" },
                        { value: "TP", label: "TP" },
                      ]
                }
                value={typeFiche ?? ""}
                onChange={(value) => {
                  const v = value ? (value as FicheTypes) : null;

                  // sécurité anti-bypass
                  if (isExam && v !== "ficheCote") return;

                  setTypeFiche(v);
                }}
              />
            </div>

            {/* RIGHT ACTIONS */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleSubmit}
                disabled={!students.length}
                /* className="w-full sm:w-auto" */
                className="w-full"
                loading={isLoading}
                size="sm"
              >
                {isSubmitting ? "Enregistrement..." : "Enregistrer"}
              </Button>

              <Button
                variant="outline"
                onClick={handleExport}
                size="sm"
                className="border-sky-600 text-sky-600! hover:bg-sky-600/10 focus-visible:border-sky-600 focus-visible:ring-sky-600/20 dark:border-sky-400 dark:text-sky-400! dark:hover:bg-sky-400/10 dark:focus-visible:border-sky-400 dark:focus-visible:ring-sky-400/40"
              >
                <FaFileExcel />
                Export
              </Button>
              <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-sky-600 bg-background px-3 text-sm font-medium text-sky-600 shadow-xs transition-colors hover:bg-sky-600/10 sm:w-auto dark:border-sky-400 dark:text-sky-400 dark:hover:bg-sky-400/10">
                <CircleFadingArrowUpIcon size={40} />
                Import
                <Input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleImport}
                />
              </label>
            </div>
          </div>

          {/* ===== CONTENU ===== */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
            {/* ===== MATIÈRES ===== */}
            <Card className="col-span-1 md:col-span-2 lg:col-span-3">
              <CardHeader>
                <CardTitle>Matières</CardTitle>
              </CardHeader>

              <CardContent className="overflow-x-auto">
                <div className="min-w-fit">
                  <DataTable
                    className="min-w-fit"
                    columns={lessonColumns(
                      setSelectedLessonId,
                      selectedLessonId,
                    )}
                    data={
                      selectedTeacher
                        ? selectedTeacher.lessons
                            .filter((l) => !isLocked(l)) // cache les locked
                            .map((l) => ({
                              id: l.id,
                              className: l.codeclasse,
                              subjectName: l.subjectName,
                              disabled: isLocked(l), // garde cohérence UI
                            }))
                        : []
                    }
                    onRowClick={(row) => {
                      if (row.disabled) return;
                      setSelectedLessonId(row.id);
                    }}
                    selectedRowId={selectedLessonId ?? undefined}
                    getRowId={(row) => row.id}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ===== TABLE ÉLÈVES ===== */}
            <Card className="col-span-1 md:col-span-2 lg:col-span-9">
              <CardHeader className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <CardTitle>Élèves</CardTitle>

                {/* Progress bar */}
                <div className="w-full sm:w-40 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      percentage === 100 ? "bg-green-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </CardHeader>

              <CardContent className="overflow-x-auto">
                <div className="min-w-fit">
                  <ResponsiveDataTable<StudentRow, unknown>
                    data={students}
                    columns={columns}
                    ToolbarComponent={NotesToolbar}
                    emptyText="Aucun élève trouvé"
                    mobileCardTitle={(s) => `${s.name} ${s.firstname}`}
                    mobileCardSubtitle={(s) => s.classname}
                    mobileCardBadges={(s) => [
                      {
                        label: `${s.score ?? 0}/${s.maxScore}`,
                        variant: "secondary",
                      },
                      { label: s.sex },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </Card>
      </LayoutBody>
    </Layout>
  );
}
