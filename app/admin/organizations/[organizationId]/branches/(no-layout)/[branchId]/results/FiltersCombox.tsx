"use client";

import { useEffect, useMemo } from "react";

import { Combobox } from "@/components/ui/combox";
import { getAcademicPeriodOrder } from "@/lib/academic-structure";
import { StudentType } from "@/lib/types";

import { MultiSelect } from "../paiement/components/MultiSelect";

type ClassType = {
  id: string;
  name: string;
  capacity: number;
  supervisor: string;
};

type FiltersComboxProps = {
  classOptions: ClassType[];
  selectedClassIds: string[];
  setSelectedClassIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedPeriod: string;
  setSelectedPeriod: React.Dispatch<React.SetStateAction<string>>;
  selectedYear: string;
  setSelectedYear: React.Dispatch<React.SetStateAction<string>>;
  students: StudentType[];
  selectedStudentId: string;
  setSelectedStudentId: React.Dispatch<React.SetStateAction<string>>;
  periods: string[];
  years: string[];
  role?: string;
};

export default function FiltersCombox({
  classOptions,
  selectedClassIds,
  setSelectedClassIds,
  selectedPeriod,
  setSelectedPeriod,
  selectedYear,
  setSelectedYear,
  students,
  selectedStudentId,
  setSelectedStudentId,
  periods,
  years,
  role,
}: FiltersComboxProps) {
  // ✅ Classes uniques
  const uniqueClasses = useMemo(
    () => Array.from(new Map(classOptions.map((c) => [c.id, c])).values()),
    [classOptions],
  );

  // ✅ Students uniques (évite bug React key + boucle useEffect)
  const uniqueStudents = useMemo(
    () => Array.from(new Map(students.map((s) => [s.studentid, s])).values()),
    [students],
  );

  // ✅ Ordre des périodes
  const sortedPeriods = useMemo(
    () =>
      [...periods].sort(
        (a, b) => getAcademicPeriodOrder(a) - getAcademicPeriodOrder(b),
      ),
    [periods],
  );

  // ✅ Admin seulement → filtre par classe
  const filteredStudents = useMemo(
    () =>
      role === "admin"
        ? uniqueStudents.filter((s) =>
            selectedClassIds.includes(s.classid.toString()),
          )
        : uniqueStudents,
    [role, uniqueStudents, selectedClassIds],
  );

  // 🔥 Reset student quand classe change (admin only)
  useEffect(() => {
    if (role === "admin") {
      setSelectedStudentId("");
    }
  }, [role, selectedClassIds, setSelectedStudentId]);

  // 🔥 Parent / élève → forcer un studentId (jamais « tous » — unit-10)
  useEffect(() => {
    if (
      (role === "parent" || role === "student") &&
      uniqueStudents.length > 0 &&
      !selectedStudentId
    ) {
      setSelectedStudentId(String(uniqueStudents[0].studentid));
    }
  }, [role, uniqueStudents, selectedStudentId, setSelectedStudentId]);

  // 🔥 Parent / élève → auto définir classe depuis student
  useEffect(() => {
    if (!(role === "parent" || role === "student") || !selectedStudentId) {
      return;
    }

    const student = uniqueStudents.find(
      (s) => String(s.studentid) === String(selectedStudentId),
    );
    if (!student) return;

    const nextClassId = String(student.classid);
    setSelectedClassIds((current) => {
      if (current.length === 1 && current[0] === nextClassId) {
        return current;
      }
      return [nextClassId];
    });
  }, [selectedStudentId, role, uniqueStudents, setSelectedClassIds]);

  // 🔥 Période auto
  useEffect(() => {
    if (
      selectedClassIds.length > 0 &&
      sortedPeriods.length > 0 &&
      !selectedPeriod
    ) {
      setSelectedPeriod(sortedPeriods[0]);
    }
  }, [selectedClassIds, sortedPeriods, selectedPeriod, setSelectedPeriod]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between w-full">
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full">
        {/* ✅ Classe → ADMIN ONLY */}
        {role === "admin" && (
          <div className="flex flex-col gap-1 w-full sm:w-[250px]">
            <span className="text-xs font-medium text-gray-500 ml-1">
              Classes
            </span>
            <MultiSelect
              className="w-full"
              options={uniqueClasses.map((c) => ({
                label: c.name,
                value: c.id.toString(),
              }))}
              value={selectedClassIds}
              onValueChange={setSelectedClassIds}
              placeholder="Classes"
            />
          </div>
        )}

        {/* ✅ Étudiant → ADMIN + PARENT */}
        {(role === "admin" || role === "parent") && (
          <div className="w-full sm:w-auto min-w-[200px]">
            <Combobox
              label="Élève"
              items={filteredStudents.map((s) => ({
                value: String(s.studentid),
                label: `${s.username} ${s.nom}`,
              }))}
              value={selectedStudentId ? String(selectedStudentId) : ""}
              onChange={setSelectedStudentId}
              placeholder="Sélectionnez un élève"
            />
          </div>
        )}

        {/* ✅ Période */}
        {selectedClassIds.length > 0 && (
          <div className="w-full sm:w-auto min-w-[180px]">
            <Combobox
              label="Période"
              items={sortedPeriods.map((p) => ({
                value: p,
                label: p,
              }))}
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              placeholder="Sélectionnez une période"
            />
          </div>
        )}

        {/* ✅ Année */}
        {selectedClassIds.length > 0 && (
          <div className="w-full sm:w-auto min-w-[120px]">
            <Combobox
              label="Année"
              items={years.map((y) => ({
                value: y,
                label: y,
              }))}
              value={selectedYear}
              onChange={setSelectedYear}
              placeholder="Année scolaire"
            />
          </div>
        )}
      </div>
    </div>
  );
}
