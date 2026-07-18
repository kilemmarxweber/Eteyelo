"use client";

import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-toastify";
import { getLessonsWithFichesByClass, getPeriods } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
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
  CalendarDays,
  Eye,
  GraduationCap,
  School,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  getSchoolYearDisplayLabel,
  getSchoolYearDisplayLabelLower,
} from "@/lib/university-lmd";
import type { BulletinBranchContext } from "@/lib/bulletin-context";
import {
  calculateBulletinPercentage,
  resolveBulletinMaxScore,
  sumBulletinMaxima,
} from "@/lib/bulletin-maxima";
import {
  getBulletinNoteSubjectKey,
  normalizeBulletinSubjectKey,
} from "@/lib/bulletin-subjects";
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

/** Une seule cote par cours/période : fusionne par coursId ou nom normalisé. */
function upsertPeriodSubjectNote(
  period: RecapPeriod,
  fiche: Pick<
    Fiche,
    | "subjectName"
    | "coursId"
    | "periodName"
    | "anneeName"
    | "application"
    | "conduite"
    | "comment"
    | "coursePonderation"
    | "primaryDomain"
    | "primarySection"
    | "domainOrder"
  >,
  studentNote: StudentNote,
) {
  const mergeKey = getBulletinNoteSubjectKey({
    coursId: fiche.coursId,
    subjectName: fiche.subjectName,
  });

  const existingEntry = Object.entries(period.notes).find(([name, note]) => {
    if (fiche.coursId && note.coursId && note.coursId === fiche.coursId) {
      return true;
    }
    return (
      getBulletinNoteSubjectKey({
        coursId: note.coursId,
        subjectName: name,
      }) === mergeKey ||
      normalizeBulletinSubjectKey(name) ===
        normalizeBulletinSubjectKey(fiche.subjectName)
    );
  });

  const noteKey = existingEntry?.[0] ?? fiche.subjectName.trim();
  const previous = existingEntry?.[1];
  const nextScore = Number(studentNote.score) || 0;

  period.notes[noteKey] = {
    score: nextScore !== 0 ? nextScore : (previous?.score ?? 0),
    maxScore: getPreparedMaxScore(studentNote, fiche) || previous?.maxScore || 0,
    periodName: fiche.periodName,
    anneeName: fiche.anneeName,
    coursId: fiche.coursId ?? previous?.coursId,
    primaryDomain: fiche.primaryDomain ?? previous?.primaryDomain ?? null,
    primarySection: fiche.primarySection ?? previous?.primarySection ?? null,
    domainOrder: fiche.domainOrder ?? previous?.domainOrder ?? null,
    application: fiche.application,
    connduite: fiche.conduite,
    comment: fiche.comment,
  };
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
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedAnnee, setSelectedAnnee] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [totalPeriods, setTotalPeriods] = useState(0);
  const schoolYearLabel = useMemo(
    () => getSchoolYearDisplayLabel(branchContext.branchType),
    [branchContext.branchType],
  );
  const schoolYearLabelLower = useMemo(
    () => getSchoolYearDisplayLabelLower(branchContext.branchType),
    [branchContext.branchType],
  );
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

  /**
   * % = points obtenus / somme des maxima de période de TOUS les cours en fiche
   * (indépendant du filtre d'affichage des colonnes matières).
   */
  const computePeriodPercentage = useCallback(
    (studentPeriods: RecapPeriod[], periodName: string) => {
      const notes = getNotesForPeriods(studentPeriods, periodName);
      const subjectNotes = Object.values(notes);
      const totalScore = subjectNotes.reduce((sum, n) => sum + n.score, 0);
      const totalMax = sumBulletinMaxima(
        subjectNotes.map((note) => note.maxScore),
      );
      return {
        totalScore,
        totalMax,
        pct: calculateBulletinPercentage(totalScore, totalMax),
      };
    },
    [getNotesForPeriods],
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
  /** Fiches de cotation de base (pas évaluations / devoirs intermédiaires). */
  const isBaseCotationFiche = useCallback(
    (f: Pick<Fiche, "typeFiche">) => f.typeFiche === "ficheCote",
    [],
  );

  const getFilteredFiches = useCallback(
    (source: Fiche[]) => {
      const allowedPeriods = selectedPeriod
        ? getAggregatedPeriods(selectedPeriod)
        : [];

      return source.filter((f) => {
        if (!isBaseCotationFiche(f)) return false;

        const matchPeriod = selectedPeriod
          ? allowedPeriods.includes(f.periodName)
          : true;

        const matchAnnee = selectedAnnee ? f.anneeName === selectedAnnee : true;

        return matchPeriod && matchAnnee;
      });
    },
    [selectedPeriod, selectedAnnee, getAggregatedPeriods, isBaseCotationFiche],
  );

  const filteredFiches = useMemo(() => {
    return getFilteredFiches(fiches);
  }, [fiches, getFilteredFiches]);

  const filteredFichespdf = useMemo(() => {
    return getFilteredFiches(fiches);
  }, [fiches, getFilteredFiches]);
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

        upsertPeriodSubjectNote(period, fiche, studentNote);
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
  /**
   * Uniquement les cours ayant une fiche de cotation pour la période + année
   * sélectionnées (pas tous les cours de la branche / périodes précédentes).
   */
  const availableSubjects = useMemo(() => {
    if (!selectedPeriod || !selectedAnnee) return [];

    return Array.from(
      new Set(
        fiches
          .filter(
            (f) =>
              f.typeFiche === "ficheCote" &&
              f.periodName === selectedPeriod &&
              f.anneeName === selectedAnnee &&
              Boolean(f.subjectName?.trim()) &&
              f.subjectName.trim() !== "-",
          )
          .map((f) => f.subjectName.trim()),
      ),
    ).sort((a, b) => a.localeCompare(b, "fr"));
  }, [fiches, selectedPeriod, selectedAnnee]);

  /** Matières réellement affichées : intersection sélection ∩ fiches de la période. */
  const visibleSubjects = useMemo(
    () => selectedSubjects.filter((s) => availableSubjects.includes(s)),
    [selectedSubjects, availableSubjects],
  );

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
        upsertPeriodSubjectNote(period, fiche, studentNote);
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

  const DEFAULT_SUBJECT_LIMIT = 15;

  useEffect(() => {
    if (availableSubjects.length === 0) {
      setSelectedSubjects([]);
      return;
    }

    setSelectedSubjects((prev) => {
      const stillValid = prev.filter((s) => availableSubjects.includes(s));
      if (stillValid.length > 0) return stillValid;
      return availableSubjects.slice(0, DEFAULT_SUBJECT_LIMIT);
    });
  }, [availableSubjects]);
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
        const { totalScore, totalMax, pct } = computePeriodPercentage(
          student.periods,
          selectedPeriod,
        );

        return {
          ...student,
          periods: student.periods,
          notes,
          totalScore,
          totalMax,
          pct,
        };
      })
      .sort((a, b) => b.pct - a.pct)
      .map((student, index) => ({ ...student, rank: index + 1 }));
  }, [ficheRecap, selectedPeriod, getNotesForPeriods, computePeriodPercentage]);

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
        const { pct } = computePeriodPercentage(r.periods, selectedPeriod);
        return {
          studentId: r.studentId,
          pct,
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [ficheRecap, selectedPeriod, computePeriodPercentage]);

  // Exemple : récupérer tous les élèves de la classe 1 pour l'année 2026
  const ficheRecapColumns: ColumnDef<RecapRow>[] = useMemo(() => {
    const scoreColMeta = {
      headerClassName:
        "overflow-hidden px-1.5 pb-1 pt-2 text-center align-bottom",
      cellClassName: "px-1.5 text-center align-middle",
    } as const;

    /** En-tête vertical centré, contenu dans la zone titre (pas de débordement bas) */
    const rotatedHeader = (label: string) => (
      <div className="relative mx-auto h-[92px] w-full min-w-[2.5rem]">
        <span
          className="absolute bottom-3 left-1/2 origin-bottom -translate-x-1/2 -rotate-90 whitespace-nowrap text-[11px] font-semibold leading-none text-foreground"
          title={label}
        >
          {label}
        </span>
      </div>
    );

    const subjectColumns: ColumnDef<RecapRow>[] = visibleSubjects.map(
      (sub) => ({
        id: sub,
        meta: scoreColMeta,
        header: () => rotatedHeader(sub),
        cell: ({ row }) => {
          const notes = getNotesForPeriods(
            row.original.periods,
            selectedPeriod,
          );
          const score = notes[sub]?.score;
          return (
            <span className="inline-block min-w-[1.5rem] text-center font-medium tabular-nums">
              {score !== undefined && score !== null ? score : "—"}
            </span>
          );
        },
      }),
    );

    const pctColumn: ColumnDef<RecapRow> = {
      accessorFn: (row) =>
        computePeriodPercentage(row.periods, selectedPeriod).pct,
      id: "pct",
      meta: {
        headerClassName:
          "min-w-[4.5rem] overflow-hidden px-1.5 pb-1 pt-2 text-center align-bottom",
        cellClassName: "min-w-[4.5rem] px-1.5 text-center align-middle",
      },
      header: () => rotatedHeader("Pourcentage"),
      cell: (info) => (
        <span className="inline-block text-center tabular-nums text-muted-foreground">
          {(info.getValue() as number).toFixed(1)}%
        </span>
      ),
    };

    const placeColumn: ColumnDef<RecapRow> = {
      id: "place",
      meta: scoreColMeta,
      header: () => rotatedHeader("Place"),
      cell: ({ row }) => {
        const studentPct = rankingData.find(
          (p) => p.studentId === row.original.studentId,
        );
        if (!studentPct) return "—";

        const rank =
          rankingData.filter((p) => p.pct > studentPct.pct).length + 1;
        return (
          <span className="inline-block text-center font-medium tabular-nums">
            {rank}
          </span>
        );
      },
    };

    const actionColumn: ColumnDef<RecapRow> = {
      id: "action",
      meta: {
        headerClassName:
          "w-14 min-w-14 overflow-hidden px-1.5 pb-1 pt-2 text-center align-bottom",
        cellClassName: "w-14 min-w-14 px-1.5 text-center align-middle",
      },
      header: () => rotatedHeader("Action"),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <BulletinPDF
            data={bulletinDataForPDF.filter(
              (s) =>
                s.studentId === row.original.studentId &&
                s.studentclasse === row.original.studentclasse,
            )}
            branchContext={branchContext}
            classCode={selectedClass?.codename}
            classLevel={selectedClass?.level}
            classOptionName={selectedClass?.optionName}
            schoolYear={
              selectedAnnee ||
              bulletinDataForPDF[0]?.periods?.[0]?.anneeName ||
              ""
            }
          />
        </div>
      ),
    };

    return [
      {
        accessorKey: "nom",
        meta: {
          headerClassName:
            "min-w-[9rem] overflow-hidden px-3 pb-1 pt-2 text-left align-bottom",
          cellClassName: "min-w-[9rem] px-3 text-left align-middle",
        },
        header: () => (
          <span className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nom
          </span>
        ),
        cell: ({ row }) => (
          <span className="block truncate font-medium" title={row.original.nom}>
            {row.original.nom}
          </span>
        ),
      },
      ...subjectColumns,
      pctColumn,
      placeColumn,
      actionColumn,
    ];
  }, [
    visibleSubjects,
    selectedPeriod,
    selectedAnnee,
    selectedClass,
    bulletinDataForPDF,
    branchContext,
    getNotesForPeriods,
    computePeriodPercentage,
    rankingData,
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
  const hasFilters = Boolean(selectedClassId && selectedPeriod && selectedAnnee);
  const studentCount = ficheRecapSorted.length;

  return (
    <Layout>
      <LayoutBody className="space-y-6">
        <PageHeader
          title="Fiches & bulletins"
          description={
            hasClasse
              ? `Notes et export des bulletins — ${selectedClass?.name ?? ""}`
              : "Sélectionnez une classe, une année et une période pour générer les bulletins"
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ContextCard
            icon={<School className="size-5" />}
            label="Classe"
            value={selectedClass?.codename ?? "Non sélectionnée"}
            active={Boolean(selectedClassId)}
          />
          <ContextCard
            icon={<CalendarDays className="size-5" />}
            label="Période"
            value={selectedPeriod || "Non sélectionnée"}
            active={Boolean(selectedPeriod)}
          />
          <ContextCard
            icon={<GraduationCap className="size-5" />}
            label={schoolYearLabel}
            value={selectedAnnee || "Non sélectionnée"}
            active={Boolean(selectedAnnee)}
          />
          <ContextCard
            icon={<Users className="size-5" />}
            label="Élèves"
            value={
              hasFilters
                ? `${studentCount} élève${studentCount > 1 ? "s" : ""}`
                : "—"
            }
            active={hasFilters && studentCount > 0}
          />
        </div>

        <Card
          variant="elevated"
          padding="none"
          className="animate-fade-in overflow-hidden rounded-lg border"
        >
          <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 lg:flex-row lg:items-end lg:justify-between lg:p-5">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                label="Année"
                items={availableAnnees.map((a) => ({
                  value: a.value,
                  label: a.label,
                }))}
                value={selectedAnnee}
                onChange={(val) => setSelectedAnnee(val)}
                placeholder="Sélectionnez une année"
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
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <BulletinPDF
                data={bulletinDataForPDF}
                branchContext={branchContext}
                classCode={selectedClass?.codename}
                classLevel={selectedClass?.level}
                classOptionName={selectedClass?.optionName}
                schoolYear={
                  selectedAnnee ||
                  bulletinDataForPDF[0]?.periods?.[0]?.anneeName ||
                  ""
                }
                label={
                  selectedAnnee
                    ? `Exporter les bulletins (${selectedAnnee})`
                    : "Exporter les bulletins"
                }
                variant="default"
                size="sm"
              />
            </div>
          </div>

          <CardHeader className="space-y-0 border-b bg-muted/10 px-4 py-3 lg:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Résultats de cotation</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {hasFilters
                    ? `${studentCount} élève${studentCount > 1 ? "s" : ""} · ${visibleSubjects.length} matière${visibleSubjects.length > 1 ? "s" : ""} affichée${visibleSubjects.length > 1 ? "s" : ""}`
                    : "Complétez les filtres pour afficher le tableau"}
                </p>
              </div>
              {hasFilters && availableSubjects.length > 0 && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <SubjectMultiSelect
                    options={availableSubjects.map((sub) => ({
                      value: sub,
                      label: sub,
                    }))}
                    value={selectedSubjects}
                    onChange={setSelectedSubjects}
                    onSelectAll={() => setSelectedSubjects(availableSubjects)}
                    onReset={() => setSelectedSubjects([])}
                  />
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="px-4 py-3 lg:px-5 lg:py-4">
            {!selectedClassId ? (
              <EmptyState message="Choisissez une classe pour charger les fiches." />
            ) : !selectedAnnee || !selectedPeriod ? (
              <EmptyState message={`Sélectionnez l'${schoolYearLabelLower} et la période pour afficher les résultats.`} />
            ) : studentCount === 0 ? (
              <EmptyState message="Aucune fiche trouvée pour cette combinaison classe / année / période." />
            ) : visibleSubjects.length === 0 ? (
              <EmptyState message="Aucune matière de cotation à afficher pour ces filtres." />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <DataTable
                  columns={ficheRecapColumns}
                  data={ficheRecapSorted}
                  className="w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </LayoutBody>
    </Layout>
  );
}

function ContextCard({
  icon,
  label,
  value,
  active,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <Card
      className={cn(
        "flex items-center gap-3 p-4 transition",
        active ? "border-primary/30 bg-primary/5" : "bg-muted/10",
      )}
    >
      <div
        className={cn(
          "rounded-xl p-2.5",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold" title={value}>
          {value}
        </p>
      </div>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex w-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/10 px-6 py-12">
      <IconClipboardText className="size-8 shrink-0 text-muted-foreground/50" />
      <p className="max-w-7xl text-center text-sm leading-relaxed text-muted-foreground text-balance">
        {message}
      </p>
    </div>
  );
}
