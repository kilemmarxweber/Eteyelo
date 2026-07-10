"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { Result } from "@/lib/types";
import { getAcademicGroupLabels } from "@/lib/academic-structure";

const FiltersCombox = dynamic(() => import("./FiltersCombox"), {
  ssr: false,
});

import ResultTable from "./ResultTable";

export default function FiltersWrapper({
  data,
  classOptions,
  role,
  onTotalChange,
  students,
  selectedStudentId,
  setSelectedStudentId,
  onStatsUpdate,
}: any) {
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  // ================= PERIODS =================
  const uniquePeriods: string[] = useMemo(() => {
    return Array.from(
      new Set<string>(data.map((d: Result) => String(d.periodName))),
    );
  }, [data]);

  useEffect(() => {
    if (!selectedPeriod && uniquePeriods.length > 0) {
      setSelectedPeriod(uniquePeriods[0]);
    }
  }, [uniquePeriods, selectedPeriod]);

  // ================= YEARS =================
  const years: string[] = useMemo(() => {
    return Array.from(new Set(data.map((d: Result) => String(d.yearName))));
  }, [data]);
  // 🔥 AUTO SELECT YEAR (FIX IMPORTANT)
  useEffect(() => {
    if (!selectedYear && years.length > 0) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  const allowedPeriods = useMemo(() => {
    if (!selectedPeriod) return [];

    if (selectedPeriod.startsWith("Exam")) {
      return getAcademicGroupLabels(selectedPeriod);
    }

    return [selectedPeriod];
  }, [selectedPeriod]);
  // ================= FILTER (TABLE ONLY) =================
  const filteredData = useMemo(() => {
    if (selectedClassIds.length === 0) return [];

    return data.filter((item: any) => {
      const matchClass = selectedClassIds.includes(item.classId.toString());

      const matchStudent = selectedStudentId
        ? item.studentId === selectedStudentId
        : true;

      const matchYear =
        !selectedYear || String(item.yearName) === String(selectedYear); // 🔥 FIX ICI

      const matchPeriod =
        allowedPeriods.length === 0 || allowedPeriods.includes(item.periodName);
      return matchClass && matchStudent && matchYear && matchPeriod;
    });
  }, [data, selectedClassIds, selectedStudentId, selectedYear, selectedPeriod]);
  // ================= GROUPING (TABLE) =================
  const groupedData = useMemo(() => {
    if (!filteredData?.length) return [];

    const map = new Map<string, any>();

    filteredData.forEach((item: any) => {
      if (!map.has(item.name)) {
        map.set(item.name, {
          id: item.name,
          studentId: item.studentId,
          name: item.name,
          sexe: item.sexe,
          classId: item.classId,
          periodName: item.periodName,
          yearName: item.yearName,
          count: 0,
          noteSum: 0,
          totalSum: 0,
        });
      }

      const entry = map.get(item.name);

      // ✅ accumulation correcte
      entry.count += 1;
      entry.noteSum += item.note ?? 0;
      entry.totalSum += item.total ?? 0;
    });

    return Array.from(map.values()).map((item) => {
      const percentage =
        item.totalSum > 0
          ? Number(((item.noteSum / item.totalSum) * 100).toFixed(1))
          : 0;

      return {
        id: item.id,
        name: item.name,
        classId: item.classId,
        periodName: item.periodName,
        yearName: item.yearName,
        studentId: item.studentId,

        // 🔥 données utiles
        note: item.noteSum, // somme réelle des points
        total: item.totalSum, // somme des max
        percentage, // % final

        count: item.count,
        sexe: item.sexe,

        // champs TS
        date: "",
        status: undefined,
        Maxscore: undefined,
        TypeFiche: undefined,
        Comment: undefined,
      };
    });
  }, [filteredData]);
  // ================= TOTAL =================
  const totalScore = useMemo(
    () => groupedData.reduce((a: number, b: any) => a + b.note, 0),
    [groupedData],
  );

  const totalMax = useMemo(
    () => groupedData.reduce((a: number, b: any) => a + b.total, 0),
    [groupedData],
  );

  const totalPercentage =
    totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(1) : "0.0";
  useEffect(() => {
    onTotalChange?.(totalPercentage);
  }, [totalPercentage]);

  // ================= RANKING BASE (IMPORTANT FIX) =================
  const studentsBase = useMemo(() => {
    const map = new Map<string, any>();

    data.forEach((item: any) => {
      if (selectedClassIds.length === 0) return;
      if (!selectedClassIds.includes(item.classId.toString())) return;

      const matchYear = !selectedYear || item.yearName === selectedYear;
      const normalize = (v: string) => v.trim().toLowerCase();
      const matchPeriod =
        allowedPeriods.length === 0 ||
        allowedPeriods.map(normalize).includes(normalize(item.periodName));

      if (!matchYear || !matchPeriod) return;

      if (!map.has(item.id)) {
        map.set(item.id, {
          id: item.id,
          name: item.name,
          noteSum: 0,
          totalSum: 0,
          sexe: item.sexe,
        });
      }

      const entry = map.get(item.id);

      entry.noteSum += item.note ?? 0;
      entry.totalSum += item.total ?? 0;
    });

    return Array.from(map.values()).map((s) => ({
      ...s,
      avg: s.totalSum > 0 ? s.noteSum / s.totalSum : 0,
    }));
  }, [data, selectedClassIds, selectedYear, selectedPeriod, allowedPeriods]);
  const totalStudents = useMemo(() => {
    return studentsBase.length;
  }, [studentsBase]);
  // ================= RANK (FIXED) =================
  const rank = useMemo(() => {
    if (!selectedStudentId) return 0;

    const ranked = [...studentsBase].sort((a, b) => b.avg - a.avg);

    let currentRank = 0;
    let lastAvg = -1;
    let result = 0;

    ranked.forEach((s, i) => {
      if (s.avg !== lastAvg) {
        currentRank = i + 1;
        lastAvg = s.avg;
      }

      if (s.id === selectedStudentId) {
        result = currentRank;
      }
    });

    return result;
  }, [studentsBase, selectedStudentId]);

  const sexeStats = useMemo(() => {
    if (selectedClassIds.length === 0) {
      return {
        M: { percent: "0.0", count: 0, successRate: "0.0" },
        F: { percent: "0.0", count: 0, successRate: "0.0" },
        total: { count: 0 },
      };
    }

    type Sexe = "M" | "F";

    const map: Record<Sexe, { count: number; successCount: number }> = {
      M: { count: 0, successCount: 0 },
      F: { count: 0, successCount: 0 },
    };

    // 🔥 IMPORTANT : utiliser studentsBase (PAS data)
    studentsBase.forEach((student: any) => {
      const sexe = student.sexe as Sexe | undefined;
      if (sexe !== "M" && sexe !== "F") return;

      map[sexe].count += 1;
      // student.avg est calculé comme noteSum / totalSum (valeur entre 0 et 1)
      if (student.avg >= 0.5) {
        map[sexe].successCount += 1;
      }
    });

    const total = map.M.count + map.F.count;

    const percentM = total > 0 ? (map.M.count / total) * 100 : 0;
    const percentF = total > 0 ? (map.F.count / total) * 100 : 0;

    const successRateM =
      map.M.count > 0 ? (map.M.successCount / map.M.count) * 100 : 0;
    const successRateF =
      map.F.count > 0 ? (map.F.successCount / map.F.count) * 100 : 0;

    return {
      M: {
        percent: percentM.toFixed(1),
        count: map.M.count,
        successRate: successRateM.toFixed(1),
      },
      F: {
        percent: percentF.toFixed(1),
        count: map.F.count,
        successRate: successRateF.toFixed(1),
      },
      total: {
        count: total,
      },
    };
  }, [studentsBase, selectedClassIds]);

  // ================= GLOBAL STATS =================
  const globalStats = useMemo(() => {
    if (selectedClassIds.length === 0) return { avg: "0.0", count: 0 };

    let totalNotes = 0;
    let totalMax = 0;

    data.forEach((item: any) => {
      if (!selectedClassIds.includes(item.classId.toString())) return;

      const matchYear =
        !selectedYear || String(item.yearName) === String(selectedYear);
      const matchPeriod =
        allowedPeriods.length === 0 || allowedPeriods.includes(item.periodName);

      if (matchYear && matchPeriod) {
        totalNotes += item.note ?? 0;
        totalMax += item.total ?? 0;
      }
    });

    return {
      avg: totalMax > 0 ? ((totalNotes / totalMax) * 100).toFixed(1) : "0.0",
      count: studentsBase.length,
    };
  }, [
    data,
    selectedClassIds,
    selectedYear,
    selectedPeriod,
    allowedPeriods,
    studentsBase,
  ]);

  useEffect(() => {
    onStatsUpdate?.({ sexeStats, globalStats });
  }, [sexeStats, globalStats, onStatsUpdate]);

  return (
    <>
      <FiltersCombox
        classOptions={classOptions}
        selectedClassIds={selectedClassIds}
        setSelectedClassIds={setSelectedClassIds}
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedStudentId={selectedStudentId}
        setSelectedStudentId={setSelectedStudentId}
        students={students}
        periods={uniquePeriods}
        years={years}
        role={role}
      />

      <ResultTable
        data={groupedData}
        totalPercentage={totalPercentage}
        rank={rank}
        totalStudent={totalStudents}
        sexeStats={sexeStats} // ✅ AJOUT ICI
      />
    </>
  );
}
