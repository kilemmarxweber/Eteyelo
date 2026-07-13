"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "react-toastify";
import { getLessonsWithFichesByClass, getPeriods } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combox";
import BulletinPDF from "./useBulletinPDF";
import { SubjectMultiSelect } from "./SubjectMultiSelect";
import {
  ClassType,
  Fiche,
  formatOrdinalFR,
  ApplicationType,
  RecapPeriod,
  RecapRow,
  TypeFiche,
} from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { IconClipboardText } from "@tabler/icons-react";
import {
  buildPeriodFieldMap,
  filterPeriodsForGroup,
  getAcademicGroupTotalKey,
  getAcademicPeriodKey,
  getAcademicPeriodOrder,
  getAcademicStructure,
  getStorageGroupKey,
  isAcademicExamPeriodName,
  isAcademicGroupComplete,
  type AcademicGroupConfig,
} from "@/lib/academic-structure";
import type { BulletinBranchContext } from "@/lib/bulletin-context";
import {
  calculateBulletinPercentage,
  resolveBulletinMaxScore,
  sumBulletinMaxima,
} from "@/lib/bulletin-maxima";
type StudentNote = {
  studentId: string;
  nom: string;
  studentSurname: string;
  studentusername: string;
  studentnaissance: string;
  studentclasse: string;
  studentSexe: string;
  score: number;
  maxScore?: number | null;
};

function isExamPeriodName(periodName: string): boolean {
  return getAcademicPeriodKey(periodName)?.startsWith("exam") ?? false;
}

function getPreparedMaxScore(
  studentNote: StudentNote,
  fiche: Pick<Fiche, "periodName" | "coursePonderation">,
): number {
  return resolveBulletinMaxScore({
    recordedMaxScore: studentNote.maxScore,
    ponderation: fiche.coursePonderation,
    isExam: isExamPeriodName(fiche.periodName),
  }).value;
}

export default function ClassFicheClient({
  classes,
  isAdmin,
  branchContext,
}: {
  classes: ClassType[];
  isAdmin: boolean;
  branchContext: BulletinBranchContext;
}) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [fiches, setFiches] = useState<Fiche[]>([]);
  const [mounted, setMounted] = useState(false);
  const [tabValue, setTabValue] = useState("fiches");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedAnnee, setSelectedAnnee] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [totalPeriods, setTotalPeriods] = useState(0);
  // ================= PERIOD AGGREGATION RULES =================
  // Retourne toutes les périodes à inclure selon selectedPeriod
  // ================= PERIOD AGGREGATION RULES =================
  const getAggregatedPeriods = useCallback(
    (selectedPeriod: string): string[] => {
      const selectedOrder = getAcademicPeriodOrder(selectedPeriod);
      if (selectedOrder === Number.MAX_SAFE_INTEGER) return [selectedPeriod];

      return Array.from(new Set(fiches.map((f) => f.periodName)))
        .filter(
          (periodName) => getAcademicPeriodOrder(periodName) <= selectedOrder,
        )
        .sort(
          (a, b) => getAcademicPeriodOrder(a) - getAcademicPeriodOrder(b),
        );
    },
    [fiches],
  );
  const availablePeriodsOrdered = useMemo(() => {
    const uniquePeriods = Array.from(new Set(fiches.map((f) => f.periodName)));

    return uniquePeriods
      .sort((a, b) => getAcademicPeriodOrder(a) - getAcademicPeriodOrder(b))
      .map((p) => ({
        id: p,
        value: p,
        label: p,
      }));
  }, [fiches]);
  // Fusionne toutes les notes des périodes actives pour un élève
  const getNotesForPeriods = useCallback(
    (studentPeriods: RecapPeriod[], selectedPeriod: string) => {
      const notesPerSubject: Record<
        string,
        { score: number; maxScore: number }
      > = {};

      const isExam = selectedPeriod.startsWith("Exam");
      let periodsToInclude: RecapPeriod[];

      if (isExam) {
        periodsToInclude = studentPeriods.filter((p) =>
          getAggregatedPeriods(selectedPeriod).includes(p.periodName),
        );
      } else {
        periodsToInclude = studentPeriods.filter(
          (p) => p.periodName === selectedPeriod,
        );
      }

      periodsToInclude.forEach((p) => {
        Object.entries(p.notes).forEach(([subject, note]) => {
          if (!notesPerSubject[subject]) {
            notesPerSubject[subject] = { score: 0, maxScore: 0 };
          }
          notesPerSubject[subject].score += note.score;
          notesPerSubject[subject].maxScore += note.maxScore;
        });
      });

      return notesPerSubject;
    },
    [getAggregatedPeriods], // ✅ important dependency
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadFiches() {
      try {
        if (!selectedClassId) {
          setFiches([]);
          return;
        }

        //setLoadingFiches(true); // ✅ ici

        const data = await getLessonsWithFichesByClass(selectedClassId);
        setFiches(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
        toast.error("Erreur lors du chargement des fiches.");
        setFiches([]);
      } finally {
        // setLoadingFiches(false); // ✅ ici
      }
    }

    loadFiches();
  }, [selectedClassId]);

  useEffect(() => {
    async function loadPeriods() {
      try {
        const data = await getPeriods();
        setTotalPeriods(data.length);
      } catch (error) {
        console.error(error);
        toast.error("Erreur lors du chargement des périodes.");
      }
    }

    loadPeriods();
  }, []);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const availableAnnees = useMemo(() => {
    const annees = new Set(fiches.map((f) => f.anneeName));
    return Array.from(annees).map((a) => ({ value: a, label: a }));
  }, [fiches]);

  // -------------------- Filtrage Fiches --------------------
  const getFilteredFiches = (fiches: any[]) => {
    const allowedPeriods = selectedPeriod
      ? getAggregatedPeriods(selectedPeriod)
      : [];

    return fiches.filter((f) => {
      const matchPeriod = selectedPeriod
        ? allowedPeriods.includes(f.periodName)
        : true;

      const matchAnnee = selectedAnnee ? f.anneeName === selectedAnnee : true;

      return matchPeriod && matchAnnee;
    });
  };
  const filteredFiches = useMemo(() => {
    return getFilteredFiches(fiches);
  }, [fiches, selectedPeriod, selectedAnnee]);

  const filteredFichespdf = useMemo(() => {
    return getFilteredFiches(fiches);
  }, [fiches, selectedPeriod, selectedAnnee]);
  // -------------------- Construction Fiche Recap --------------------
  // ------------------ FICHE RECAP ------------------
  const ficheRecapBase = useMemo(() => {
    const recap: Record<string, RecapRow> = {};
    filteredFiches.forEach((fiche) => {
      fiche.notes.forEach((studentNote: StudentNote) => {
        if (!recap[studentNote.studentId]) {
          recap[studentNote.studentId] = {
            studentId: studentNote.studentId,
            nom: studentNote.nom,
            studentSurname: studentNote.studentSurname,
            studentusername: studentNote.studentusername,
            studentnaissance: studentNote.studentnaissance,
            studentclasse: studentNote.studentclasse,
            studentSexe: studentNote.studentSexe,
            periods: [],
          };
        }

        let period = recap[studentNote.studentId].periods.find(
          (p) =>
            p.periodName === fiche.periodName &&
            p.anneeName === fiche.anneeName,
        );

        if (!period) {
          period = {
            periodName: fiche.periodName,
            anneeName: fiche.anneeName,
            notes: {},
            autres: {} as TypeFiche,
          };
          recap[studentNote.studentId].periods.push(period);
        }

        period.notes[fiche.subjectName] = {
          score: studentNote.score,
          maxScore: getPreparedMaxScore(studentNote, fiche),
          periodName: fiche.periodName,
          anneeName: fiche.anneeName,
          application: fiche.application,
          connduite: fiche.conduite,
          comment: fiche.comment,
        };
      });
    });
    return Object.values(recap);
  }, [filteredFiches]);

  const ficheRecap = useMemo(() => {
    const allowedPeriods = selectedPeriod
      ? getAggregatedPeriods(selectedPeriod)
      : [];

    return ficheRecapBase.map((student) => {
      const filteredPeriods = student.periods.filter((p) => {
        const matchPeriod = selectedPeriod
          ? allowedPeriods.includes(p.periodName)
          : true;

        const matchAnnee = selectedAnnee ? p.anneeName === selectedAnnee : true;

        return matchPeriod && matchAnnee;
      });

      return {
        ...student,
        periods: filteredPeriods,
      };
    });
  }, [ficheRecapBase, selectedPeriod, selectedAnnee, getAggregatedPeriods]);
  // ------------------ AVAILABLE SUBJECTS ------------------

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(filteredFiches.map((f) => f.subjectName))).sort();
  }, [filteredFiches]);

  const ficheRecappdf = useMemo<RecapRow[]>(() => {
    const recap: Record<string, RecapRow> = {};

    filteredFichespdf.forEach((fiche) => {
      fiche.notes.forEach((studentNote: StudentNote) => {
        if (!recap[studentNote.studentId]) {
          recap[studentNote.studentId] = {
            studentId: studentNote.studentId,
            nom: studentNote.nom,
            studentSurname: studentNote.studentSurname,
            studentusername: studentNote.studentusername,
            studentnaissance: studentNote.studentnaissance,
            studentclasse: studentNote.studentclasse,
            studentSexe: studentNote.studentSexe,
            periods: [],
          };
        }

        let period = recap[studentNote.studentId].periods.find(
          (p) =>
            p.periodName === fiche.periodName &&
            p.anneeName === fiche.anneeName,
        );

        if (!period) {
          period = {
            periodName: fiche.periodName,
            anneeName: fiche.anneeName,
            notes: {},
            autres: {} as TypeFiche,
          };
          recap[studentNote.studentId].periods.push(period);
        }
        period.notes[fiche.subjectName] = {
          score: studentNote.score,
          maxScore: getPreparedMaxScore(studentNote, fiche),
          periodName: fiche.periodName,
          anneeName: fiche.anneeName,
          application: fiche.application,
          connduite: fiche.conduite,
          comment: fiche.comment,
        };
      });
    });

    return Object.values(recap);
  }, [filteredFichespdf]);

  // ================= TABLEAU SUBJECTS =================
  const subjects = useMemo(() => {
    const setSub = new Set(filteredFichespdf.map((f) => f.subjectName));
    return Array.from(setSub);
  }, [filteredFichespdf]);

  const ficheColumns: ColumnDef<Fiche>[] = useMemo(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "teacherName", header: "Teacher" },
      { accessorKey: "subjectName", header: "Matière" },
      { accessorKey: "periodName", header: "Période" },
      {
        accessorKey: "dateCreated",
        header: "Date",
        cell: (info) => {
          const dateStr = info.getValue() as string;
          return new Date(dateStr).toLocaleDateString();
        },
      },
      { accessorKey: "anneeName", header: "Année" },
      { accessorKey: "typeFiche", header: "Type" },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              (window.location.href = `/list/fiches/${row.original.id}`)
            }
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
        ),
      },
    ],
    [],
  );

  const DEFAULT_SUBJECT_LIMIT = 7;

  useEffect(() => {
    if (selectedSubjects.length > 0) return;

    const source = availableSubjects.length > 0 ? availableSubjects : subjects;

    if (source.length === 0) return;

    setSelectedSubjects(
      source.length <= DEFAULT_SUBJECT_LIMIT
        ? source
        : source.slice(0, DEFAULT_SUBJECT_LIMIT),
    );
  }, [availableSubjects, subjects]); // ✅ ajouter subjects
  // -------------------- Tri décroissant par total périodes agrégées --------------------
  function computeRank(
    studentId: string,
    allEntries: { studentId: string; pct: number; name: string }[],
  ) {
    const sorted = [...allEntries].sort((a, b) => {
      // 1️⃣ tri principal : pourcentage DESC
      if (b.pct !== a.pct) return b.pct - a.pct;

      // 2️⃣ égalité → tri alphabétique ASC
      return a.name
        .replace(/\s+/g, "")
        .localeCompare(b.name.replace(/\s+/g, ""), "fr", {
          sensitivity: "base",
        });
    });

    const index = sorted.findIndex((s) => s.studentId === studentId);

    return index !== -1 ? formatOrdinalFR(index + 1, sorted.length) : "-";
  }
  const ficheRecapSorted = useMemo(() => {
    if (!selectedPeriod) return ficheRecap;

    return ficheRecap
      .map((student) => {
        const notes = getNotesForPeriods(student.periods, selectedPeriod);

        const totalScore = Object.values(notes).reduce(
          (sum, n) => sum + n.score,
          0,
        );
        const totalMax = sumBulletinMaxima(
          Object.values(notes).map((note) => note.maxScore),
        );
        const pct = calculateBulletinPercentage(totalScore, totalMax);

        return {
          ...student,
          periods: student.periods, // garde toutes les périodes si besoin pour PDF
          notes, // notes fusionnées par matière
          totalScore,
          totalMax,
          pct,
        };
      })
      .sort((a, b) => b.pct - a.pct)
      .map((student, index) => ({ ...student, rank: index + 1 }));
  }, [ficheRecap, selectedPeriod, getNotesForPeriods]);

  const bulletinDataForPDF: RecapRow[] = useMemo(() => {
    const branchType = branchContext.branchType;
    const academicStructure = getAcademicStructure(branchType);
    const periodMap = buildPeriodFieldMap(branchType);

    function createEmptyAutres(existing?: TypeFiche): TypeFiche {
      const createGroupRecords = (
        section: keyof TypeFiche,
        defaultValue: string,
        includeTotal = true,
      ): ApplicationType => {
        const records: Record<string, Record<string, string>> = {};

        for (const group of academicStructure.groups) {
          const storageKey = getStorageGroupKey(group);
          records[storageKey] = {
            ...((existing?.[section] as Record<string, Record<string, string>>)?.[
              storageKey
            ] ?? {}),
          };

          for (const period of group.periods) {
            records[storageKey][period.key] = defaultValue;
          }

          if (includeTotal) {
            records[storageKey][getAcademicGroupTotalKey(group.order)] =
              defaultValue;
          }

          if (group.order === academicStructure.groups.length) {
            records[storageKey].tg = defaultValue;
          }
        }

        return records as ApplicationType;
      };

      return {
        ...structuredClone(existing ?? {}),
        POURCENTAGES: createGroupRecords("POURCENTAGES", "0"),
        TOTAUX: createGroupRecords("TOTAUX", "0"),
        "PLACE/NOMBRE D'ELEVES": createGroupRecords(
          "PLACE/NOMBRE D'ELEVES",
          "",
          false,
        ),
        APPLICATIONS: createGroupRecords("APPLICATIONS", "", false),
        CONDUITE: createGroupRecords("CONDUITE", "", false),
        "SIGNATURE PARENTS": createGroupRecords("SIGNATURE PARENTS", "", false),
      };
    }

    function computeGroupTotals(periods: RecapPeriod[]): {
      score: number;
      max: number;
    } {
      return periods.reduce(
        (acc, period) => {
          acc.score += Object.values(period.notes).reduce(
            (sum, note) => sum + note.score,
            0,
          );
          acc.max += sumBulletinMaxima(
            Object.values(period.notes).map((note) => note.maxScore),
          );
          return acc;
        },
        { score: 0, max: 0 },
      );
    }

    function computeGroupRankings(group: AcademicGroupConfig) {
      return ficheRecappdf.map((student) => {
        const groupPeriods = filterPeriodsForGroup(student.periods, group);
        const totals = computeGroupTotals(groupPeriods);
        const pct = calculateBulletinPercentage(totals.score, totals.max);

        return {
          studentId: student.studentId,
          score: totals.score,
          pct,
        };
      });
    }

    function computeAnnualRankings() {
      return ficheRecappdf.map((student) => {
        const allGroupsComplete = academicStructure.groups.every((group) =>
          isAcademicGroupComplete(student.periods, group),
        );

        if (!allGroupsComplete) {
          return { studentId: student.studentId, tg: 0, pct: 0 };
        }

        const annualTotals = academicStructure.groups.reduce(
          (acc, group) => {
            const groupPeriods = filterPeriodsForGroup(student.periods, group);
            const totals = computeGroupTotals(groupPeriods);
            acc.score += totals.score;
            acc.max += totals.max;
            return acc;
          },
          { score: 0, max: 0 },
        );

        return {
          studentId: student.studentId,
          tg: annualTotals.score,
          pct: calculateBulletinPercentage(annualTotals.score, annualTotals.max),
        };
      });
    }

    function computeTotals(
      notes: Record<
        string,
        { score: number; maxScore: number; applications?: string }
      >,
      allTotals?: { studentId: string; pctEntry: number }[],
      studentId?: string,
    ) {
      const totalScore = Object.values(notes).reduce(
        (sum, n) => sum + n.score,
        0,
      );
      const totalMax = sumBulletinMaxima(
        Object.values(notes).map((note) => note.maxScore),
      );
      const pctEntry = calculateBulletinPercentage(totalScore, totalMax);

      // Calcul de la place uniquement si allTotals et studentId sont fournis
      let place: string | undefined;
      if (allTotals && studentId) {
        const sorted = [...allTotals].sort((a, b) => b.pctEntry - a.pctEntry);
        const rankIndex = sorted.findIndex((s) => s.studentId === studentId);
        place =
          rankIndex !== -1
            ? formatOrdinalFR(rankIndex + 1, allTotals.length)
            : "-";
      }
      // Application des appréciations (exemple simple, à adapter selon les règles réelles)

      return { totalScore, totalMax, pctEntry, place };
    }

    const lastGroup =
      academicStructure.groups[academicStructure.groups.length - 1];
    const lastStorageKey = lastGroup
      ? getStorageGroupKey(lastGroup)
      : "sem2";

    return ficheRecappdf.map((student) => {
      const periodsWithTotals = student.periods.map((p) => {
        // 1️⃣ Calculer pctEntry pour tous les élèves pour cette période
        const allTotalsForPeriod = ficheRecappdf.map((s) => {
          const period = s.periods.find((pr) => pr.periodName === p.periodName);
          if (!period) return { studentId: s.studentId, pctEntry: 0 };
          const totalScore = Object.values(period.notes).reduce(
            (sum, n) => sum + n.score,
            0,
          );
          const totalMax = sumBulletinMaxima(
            Object.values(period.notes).map((note) => note.maxScore),
          );
          const pctEntry = calculateBulletinPercentage(totalScore, totalMax);

          return { studentId: s.studentId, pctEntry };
        });

        // 2️⃣ Calculer total, pctEntry et place pour l'élève courant
        const { totalScore, totalMax, pctEntry, place } = computeTotals(
          p.notes,
          allTotalsForPeriod,
          student.studentId,
        );

        const autres = createEmptyAutres(p.autres);
        const mapEntry = periodMap[p.periodName];

        if (mapEntry) {
          const { storageKey: sem, field } = mapEntry;
          const semKey = sem as keyof ApplicationType;
          const semObj = autres.POURCENTAGES[semKey]!;
          const totObj = autres.TOTAUX[semKey]!;
          const semCToApObj = autres.APPLICATIONS[semKey]!;
          const semCondObj = autres.CONDUITE[semKey]!;
          const placeObj = autres["PLACE/NOMBRE D'ELEVES"][semKey] as Record<
            string,
            string
          >;
          const applications = (appreciation = "") => {
            if (pctEntry >= 85) appreciation = "Exc";
            else if (pctEntry >= 65) appreciation = "TB";
            else if (pctEntry >= 60) appreciation = "B";
            else if (pctEntry >= 50) appreciation = "AB";
            else appreciation = "AA";
            return appreciation;
          };
          const firstKey = Object.keys(p.notes)[0];

          const conduiteValue = firstKey
            ? (p.notes[firstKey]?.connduite ?? "B")
            : "B";
          // Assignation globale par période
          semCToApObj[field] = applications();
          const placeStr = place ?? "";
          semObj[field] = `${pctEntry.toFixed(1)}%`;
          totObj[field] = `${totalScore}`;
          placeObj[field] = placeStr;
          semCondObj[field] = conduiteValue;

          if (isAcademicExamPeriodName(p.periodName, branchType)) {
            const currentGroup = academicStructure.groups.find(
              (group) => getStorageGroupKey(group) === sem,
            );

            if (currentGroup) {
              const totalKey = getAcademicGroupTotalKey(currentGroup.order);
              const allGroupTotals = computeGroupRankings(currentGroup);
              const currentGroupTotal = allGroupTotals.find(
                (entry) => entry.studentId === student.studentId,
              );

              if (currentGroupTotal) {
                semObj[totalKey] = `${currentGroupTotal.pct.toFixed(1)}%`;
                totObj[totalKey] = `${currentGroupTotal.score}`;
              }

              const groupPlace = computeRank(
                student.studentId,
                allGroupTotals.map((entry) => ({
                  studentId: entry.studentId,
                  pct: entry.pct,
                  name: student.nom,
                })),
              );

              (autres["PLACE/NOMBRE D'ELEVES"][semKey] as Record<string, string>)[
                totalKey
              ] = groupPlace;

              const allGroupsComplete = academicStructure.groups.every(
                (group) => isAcademicGroupComplete(student.periods, group),
              );
              const isLastGroupExam =
                currentGroup.order === academicStructure.groups.length;

              if (allGroupsComplete && isLastGroupExam) {
                const allAnnualTotals = computeAnnualRankings();
                const currentAnnualTotal = allAnnualTotals.find(
                  (entry) => entry.studentId === student.studentId,
                );

                if (currentAnnualTotal && currentAnnualTotal.tg !== 0) {
                  const lastSemKey = lastStorageKey as keyof ApplicationType;
                  autres.TOTAUX[lastSemKey]!.tg = `${currentAnnualTotal.tg}`;
                  autres.POURCENTAGES[lastSemKey]!.tg =
                    `${currentAnnualTotal.pct.toFixed(1)}%`;

                  const placeTG = computeRank(
                    student.studentId,
                    allAnnualTotals.map((entry) => ({
                      studentId: entry.studentId,
                      pct: entry.pct,
                      name: student.nom,
                    })),
                  );

                  (autres["PLACE/NOMBRE D'ELEVES"][lastSemKey] as Record<
                    string,
                    string
                  >).tg = placeTG;
                }
              }
            }
          }
        }
        // 3️⃣ Retourner l'objet avec place
        return { ...p, totalScore, pctEntry, place, autres };
      });

      return { ...student, periods: periodsWithTotals };
    });
  }, [ficheRecappdf, branchContext.branchType]);

  const rankingData = useMemo(() => {
    return ficheRecap
      .map((r) => {
        const notes = getNotesForPeriods(r.periods, selectedPeriod);
        const values = Object.values(notes);

        const totalScore = values.reduce((s, n) => s + n.score, 0);
        const totalMax = sumBulletinMaxima(
          values.map((note) => note.maxScore),
        );

        const pct = calculateBulletinPercentage(totalScore, totalMax);

        return {
          studentId: r.studentId,
          pct,
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [ficheRecap, selectedPeriod]);

  // Exemple : récupérer tous les élèves de la classe 1 pour l'année 2026
  const ficheRecapColumns: ColumnDef<RecapRow>[] = useMemo(() => {
    const rotatedHeader = (label: string) => (
      <div className="flex flex-col items-center justify-end min-w-[60px] h-[90px]">
        <div className="rotate-[-85deg] origin-bottom-left whitespace-nowrap font-semibold">
          {label}
        </div>
      </div>
    );

    // ✅ S'assurer que map retourne ColumnDef
    const subjectColumns: ColumnDef<RecapRow>[] = selectedSubjects.map(
      (sub) => ({
        id: sub,
        header: () => rotatedHeader(sub),
        cell: ({ row }) => {
          const notes = getNotesForPeriods(
            row.original.periods,
            selectedPeriod,
          );
          const score = notes[sub]?.score;
          return score !== undefined ? score : "-";
        },
      }),
    );

    const pctColumn: ColumnDef<RecapRow> = {
      accessorFn: (row) => {
        const notes = getNotesForPeriods(row.periods, selectedPeriod);
        const values = Object.values(notes);
        const totalScore = values.reduce((s, n) => s + n.score, 0);
        const totalMax = sumBulletinMaxima(
          values.map((note) => note.maxScore),
        );
        return calculateBulletinPercentage(totalScore, totalMax);
      },
      id: "pct",
      header: () => rotatedHeader("Pourcentage"),
      cell: (info) => `${(info.getValue() as number).toFixed(1)} %`,
    };

    const placeColumn: ColumnDef<RecapRow> = {
      id: "place",
      header: () => rotatedHeader("Place"),
      cell: ({ row }) => {
        const allPercentages = ficheRecap
          .map((r) => {
            const notes = getNotesForPeriods(r.periods, selectedPeriod);
            const values = Object.values(notes);
            const totalScore = values.reduce((s, n) => s + n.score, 0);
            const totalMax = sumBulletinMaxima(
              values.map((note) => note.maxScore),
            );
            return {
              studentId: r.studentId,
              pct: calculateBulletinPercentage(totalScore, totalMax),
            };
          })
          .sort((a, b) => b.pct - a.pct);

        const studentPct = allPercentages.find(
          (p) => p.studentId === row.original.studentId,
        );
        if (!studentPct) return "-";

        const rank =
          rankingData.filter((p) => p.pct > studentPct.pct).length + 1;
        return rank;
      },
    };

    const actionColumn: ColumnDef<RecapRow> = {
      id: "action",
      header: () => rotatedHeader("Action"),
      cell: ({ row }) => (
        <BulletinPDF
          data={bulletinDataForPDF.filter(
            (s) =>
              s.studentId === row.original.studentId &&
              s.studentclasse === row.original.studentclasse,
          )}
          branchContext={branchContext}
        />
      ),
    };

    return [
      { accessorKey: "nom", header: "Nom" }, // Nom colonne
      ...subjectColumns,
      pctColumn,
      placeColumn,
      actionColumn,
    ];
  }, [
    selectedSubjects,
    selectedPeriod,
    ficheRecap,
    bulletinDataForPDF,
    branchContext,
    getNotesForPeriods,
  ]);

  // const ficheTableall = useReactTable({
  //   data: fiches,
  //   columns: ficheColumns,
  //   getCoreRowModel: getCoreRowModel(),
  //   getPaginationRowModel: getPaginationRowModel(),
  //   initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  // });

  if (!mounted) return null;

  // const currentPage = ficheTableall.getState().pagination.pageIndex;

  // const maxVisible = 3;

  // const start = Math.max(0, currentPage - Math.floor(maxVisible / 2));

  const hasClasse = !!selectedClass?.name;

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        {/* ===== HEADER ===== */}
        <PageHeader
          title="Gestion des fiches | Bulletins"
          description={
            hasClasse
              ? `Gérer les fiches des notes des élèves de : ${selectedClass?.name || ""}`
              : "Gérer les fiches des notes des élèves"
          }
          badge={
            <Badge
              variant="outline-primary"
              icon={<IconClipboardText size={14} />}
            >
              Bulletins
            </Badge>
          }
        />
        <Card
          variant="elevated"
          padding="none"
          className="animate-fade-in rounded-lg border"
        >
          <div className="p-6 space-y-6">
            {/* ================= TABS ================= */}
            <Tabs value={tabValue} onValueChange={setTabValue}>
              <TabsList>
                <TabsTrigger value="fiches">Fiches | Bulletins</TabsTrigger>
              </TabsList>
              {/* ================= FICHES RESULT ================= */}
              <TabsContent value="fiches">
                <div className="flex mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  <Combobox
                    label="Classe"
                    items={classes.map((c) => ({
                      value: c.id.toString(),
                      label: c.codename,
                    }))}
                    value={selectedClassId?.toString() || ""}
                    onChange={(val) => setSelectedClassId(val)}
                    placeholder="Sélectionnez une classe"
                  />
                  <Combobox
                    label="Période"
                    items={availablePeriodsOrdered.map((p) => ({
                      value: p.value,
                      label: p.label,
                    }))}
                    value={selectedPeriod}
                    onChange={(val) => setSelectedPeriod(val)}
                    placeholder="Sélectionnez une période"
                  />
                  <Combobox
                    label="Année"
                    items={availableAnnees.map((a) => ({
                      value: a.value,
                      label: a.label,
                    }))}
                    value={selectedAnnee}
                    onChange={(val) => setSelectedAnnee(val)}
                    placeholder="Sélectionnez une année"
                  />
                </div>
                <Card>
                  <CardContent>
                    {/* Bloc multi-select + boutons à droite */}
                    <div className="flex items-center gap-4 ml-auto p-4">
                      <SubjectMultiSelect
                        options={availableSubjects.map((sub) => ({
                          value: sub,
                          label: sub,
                        }))}
                        value={selectedSubjects}
                        onChange={setSelectedSubjects}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSubjects(availableSubjects)}
                      >
                        Tout sélectionner
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSubjects([])}
                      >
                        Réinitialiser
                      </Button>
                      <BulletinPDF
                        data={bulletinDataForPDF}
                        branchContext={branchContext}
                        label={`Exporter ${selectedAnnee ? `(${selectedAnnee})` : ""}`}
                        variant="default"
                        size="sm"
                      />
                    </div>
                    <DataTable
                      columns={ficheRecapColumns}
                      data={ficheRecapSorted}
                    />
                  </CardContent>
                </Card>
                <p className="text-gray-500"></p>
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      </LayoutBody>
    </Layout>
  );
}
