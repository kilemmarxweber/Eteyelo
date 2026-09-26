"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Combobox } from "@/components/ui/combox";
import { Label } from "@/components/ui/label";
import { getAcademicPeriodOrder } from "@/lib/academic-structure";
import { isAngolaNucleoComumOption } from "@/lib/angola-secondary-structure";
import { isCtebOption } from "@/lib/class-catalog";
import { compareClassesByLevel } from "@/lib/class-structure";
import {
  CYCLE_SORT_ORDER,
  cycleLabel,
  normalizeCycle,
  type Cycle,
} from "@/lib/cycle";
import { StudentType } from "@/lib/types";
import { cn } from "@/lib/utils";

import { MultiSelect } from "../paiement/components/MultiSelect";

const NO_OPTION_VALUE = "__none__";

type ClassOptionInfo = {
  id: string;
  nameOption: string;
  codeOption?: string | null;
};

type ClassType = {
  id: string;
  name: string;
  nameClasse?: string;
  codeClasse?: string;
  level?: string | null;
  cycle?: string | null;
  option?: ClassOptionInfo | null;
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

function classeCycle(classe: ClassType): Cycle {
  return normalizeCycle(classe.cycle);
}

function classDisplayName(classe: ClassType) {
  return classe.name || classe.codeClasse || classe.nameClasse || classe.id;
}

function optionKey(classe: ClassType) {
  return classe.option?.id || NO_OPTION_VALUE;
}

function isCommonCoreOption(option: ClassOptionInfo | null | undefined) {
  if (!option) return false;
  return (
    isCtebOption({
      nameOption: option.nameOption,
      codeOption: option.codeOption,
    }) ||
    isAngolaNucleoComumOption({
      nameOption: option.nameOption,
      codeOption: option.codeOption,
    })
  );
}

function optionLabel(
  option: ClassOptionInfo | null | undefined,
  t: ReturnType<typeof useTranslations>,
) {
  if (!option) return t("filters.noOption");
  if (isCommonCoreOption(option)) {
    return t("filters.commonCoreOption", { name: option.nameOption });
  }
  return option.nameOption;
}

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
  const t = useTranslations("cursus.results");
  const [selectedCycle, setSelectedCycle] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState("");

  const uniqueClasses = useMemo(() => {
    const classes = Array.from(
      new Map(classOptions.map((c) => [c.id, c])).values(),
    );
    return [...classes].sort((left, right) => {
      const cycleDiff =
        CYCLE_SORT_ORDER[classeCycle(left)] -
        CYCLE_SORT_ORDER[classeCycle(right)];
      if (cycleDiff !== 0) return cycleDiff;
      const optionDiff = (left.option?.nameOption || "").localeCompare(
        right.option?.nameOption || "",
        "fr",
      );
      if (optionDiff !== 0) return optionDiff;
      return compareClassesByLevel(
        {
          level: left.level,
          nameClasse: left.nameClasse || left.name,
          codeClasse: left.codeClasse || left.name,
          cycle: left.cycle,
        },
        {
          level: right.level,
          nameClasse: right.nameClasse || right.name,
          codeClasse: right.codeClasse || right.name,
          cycle: right.cycle,
        },
      );
    });
  }, [classOptions]);

  const cycleOptions = useMemo(() => {
    const values = new Set(uniqueClasses.map((classe) => classeCycle(classe)));
    return [...values]
      .sort((a, b) => CYCLE_SORT_ORDER[a] - CYCLE_SORT_ORDER[b])
      .map((cycle) => ({
        value: cycle,
        label: cycleLabel(cycle),
        search: `${cycleLabel(cycle)} ${cycle}`,
      }));
  }, [uniqueClasses]);

  const showCycleField = cycleOptions.length > 0;
  const isSecondary = selectedCycle === "SECONDAIRE";

  const classesForCycle = useMemo(() => {
    if (!selectedCycle) return [];
    return uniqueClasses.filter(
      (classe) => classeCycle(classe) === selectedCycle,
    );
  }, [selectedCycle, uniqueClasses]);

  const secondaryOptionItems = useMemo(() => {
    if (!isSecondary) return [];
    const seen = new Set<string>();
    const items: Array<{
      value: string;
      label: string;
      search: string;
      isCommonCore: boolean;
    }> = [];

    for (const classe of classesForCycle) {
      const value = optionKey(classe);
      if (seen.has(value)) continue;
      seen.add(value);
      const commonCore = isCommonCoreOption(classe.option);
      const label = optionLabel(classe.option, t);
      items.push({
        value,
        label,
        search: `${label} ${classe.option?.codeOption ?? ""} ${classe.option?.nameOption ?? ""}`,
        isCommonCore: commonCore,
      });
    }

    return items.sort((a, b) => {
      if (a.isCommonCore !== b.isCommonCore) {
        return a.isCommonCore ? -1 : 1;
      }
      return a.label.localeCompare(b.label, "fr");
    });
  }, [classesForCycle, isSecondary, t]);

  const needsOptionFilter = isSecondary && secondaryOptionItems.length > 0;

  const classesForSelection = useMemo(() => {
    if (!selectedCycle) return [];
    if (!needsOptionFilter) return classesForCycle;
    if (!selectedOptionId) return [];
    return classesForCycle.filter(
      (classe) => optionKey(classe) === selectedOptionId,
    );
  }, [classesForCycle, needsOptionFilter, selectedCycle, selectedOptionId]);

  const selectedOptionMeta = useMemo(
    () => secondaryOptionItems.find((item) => item.value === selectedOptionId),
    [secondaryOptionItems, selectedOptionId],
  );

  const classMultiOptions = useMemo(
    () =>
      classesForSelection.map((classe) => {
        const label = classDisplayName(classe);
        const cycleName = cycleLabel(classeCycle(classe));
        const optName = classe.option?.nameOption ?? "";
        return {
          value: classe.id.toString(),
          label,
          search: `${cycleName} ${optName} ${label} ${classe.nameClasse ?? ""} ${classe.codeClasse ?? ""}`,
        };
      }),
    [classesForSelection],
  );

  useEffect(() => {
    if (cycleOptions.length === 0) {
      if (selectedCycle) setSelectedCycle("");
      return;
    }
    // Ne pas auto-sélectionner : laisser le placeholder « Sélectionner un cycle ».
    if (
      selectedCycle &&
      !cycleOptions.some((option) => option.value === selectedCycle)
    ) {
      setSelectedCycle("");
    }
  }, [cycleOptions, selectedCycle]);

  // Secondaire : prioriser Tronc commun / CTEB seulement après choix du cycle.
  useEffect(() => {
    if (!needsOptionFilter) {
      if (selectedOptionId) setSelectedOptionId("");
      return;
    }
    if (
      selectedOptionId &&
      secondaryOptionItems.some((item) => item.value === selectedOptionId)
    ) {
      return;
    }
    const commonCore = secondaryOptionItems.find((item) => item.isCommonCore);
    setSelectedOptionId(
      commonCore?.value ?? secondaryOptionItems[0]?.value ?? "",
    );
  }, [needsOptionFilter, secondaryOptionItems, selectedOptionId]);

  useEffect(() => {
    if (!selectedCycle) return;
    const allowed = new Set(
      classesForSelection.map((classe) => classe.id.toString()),
    );
    setSelectedClassIds((current) => {
      const next = current.filter((id) => allowed.has(id));
      return next.length === current.length ? current : next;
    });
  }, [classesForSelection, selectedCycle, setSelectedClassIds]);

  const uniqueStudents = useMemo(
    () => Array.from(new Map(students.map((s) => [s.studentid, s])).values()),
    [students],
  );

  const sortedPeriods = useMemo(
    () =>
      [...periods].sort(
        (a, b) => getAcademicPeriodOrder(a) - getAcademicPeriodOrder(b),
      ),
    [periods],
  );

  const filteredStudents = useMemo(
    () =>
      role === "admin"
        ? uniqueStudents.filter((s) =>
            selectedClassIds.includes(s.classid.toString()),
          )
        : uniqueStudents,
    [role, uniqueStudents, selectedClassIds],
  );

  useEffect(() => {
    if (role === "admin") {
      setSelectedStudentId("");
    }
  }, [role, selectedClassIds, setSelectedStudentId]);

  useEffect(() => {
    if (
      (role === "parent" || role === "student") &&
      uniqueStudents.length > 0 &&
      !selectedStudentId
    ) {
      setSelectedStudentId(String(uniqueStudents[0].studentid));
    }
  }, [role, uniqueStudents, selectedStudentId, setSelectedStudentId]);

  useEffect(() => {
    if (!(role === "parent" || role === "student") || !selectedStudentId) {
      return;
    }

    const student = uniqueStudents.find(
      (s) => String(s.studentid) === String(selectedStudentId),
    );
    if (!student) return;

    const nextClassId = String(student.classid);
    const studentClass = uniqueClasses.find(
      (c) => c.id.toString() === nextClassId,
    );
    if (studentClass) {
      const nextCycle = classeCycle(studentClass);
      setSelectedCycle((current) =>
        current === nextCycle ? current : nextCycle,
      );
      if (nextCycle === "SECONDAIRE") {
        const nextOption = optionKey(studentClass);
        setSelectedOptionId((current) =>
          current === nextOption ? current : nextOption,
        );
      }
    }

    setSelectedClassIds((current) => {
      if (current.length === 1 && current[0] === nextClassId) {
        return current;
      }
      return [nextClassId];
    });
  }, [
    selectedStudentId,
    role,
    uniqueStudents,
    uniqueClasses,
    setSelectedClassIds,
  ]);

  useEffect(() => {
    if (
      selectedClassIds.length > 0 &&
      sortedPeriods.length > 0 &&
      !selectedPeriod
    ) {
      setSelectedPeriod(sortedPeriods[0]);
    }
  }, [selectedClassIds, sortedPeriods, selectedPeriod, setSelectedPeriod]);

  function handleCycleChange(nextCycle: string) {
    if (nextCycle === selectedCycle) return;
    setSelectedCycle(nextCycle);
    setSelectedOptionId("");
    setSelectedClassIds([]);
    setSelectedStudentId("");
  }

  function handleOptionChange(nextOption: string) {
    if (nextOption === selectedOptionId) return;
    setSelectedOptionId(nextOption);
    setSelectedClassIds([]);
    setSelectedStudentId("");
  }

  const classesReady =
    Boolean(selectedCycle) &&
    (!needsOptionFilter || Boolean(selectedOptionId));

  const adminFilterGridClass = cn(
    "grid w-full gap-3 sm:items-end",
    showCycleField && needsOptionFilter && "sm:grid-cols-3",
    showCycleField &&
      !needsOptionFilter &&
      "sm:grid-cols-[minmax(11rem,14rem)_minmax(14rem,1fr)]",
    !showCycleField &&
      needsOptionFilter &&
      "sm:grid-cols-[minmax(12rem,16rem)_minmax(14rem,1fr)]",
    !showCycleField && !needsOptionFilter && "sm:max-w-sm",
  );

  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full flex-col flex-wrap gap-3 sm:flex-row">
        {role === "admin" && (
          <div className={adminFilterGridClass}>
            {showCycleField ? (
              <Combobox
                label={t("filters.cycle")}
                items={cycleOptions}
                value={selectedCycle}
                onChange={handleCycleChange}
                placeholder={t("filters.cyclePlaceholder")}
              />
            ) : null}

            {needsOptionFilter ? (
              <Combobox
                label={t("filters.option")}
                items={secondaryOptionItems}
                value={selectedOptionId}
                onChange={handleOptionChange}
                placeholder={t("filters.optionPlaceholder")}
              />
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("filters.classes")}
                {selectedOptionMeta?.isCommonCore ? (
                  <span className="ml-1 font-normal text-muted-foreground/80">
                    · {t("filters.commonCoreHint")}
                  </span>
                ) : null}
              </Label>
              <MultiSelect
                className="h-9 min-h-9 w-full"
                options={classMultiOptions}
                value={selectedClassIds}
                onValueChange={setSelectedClassIds}
                placeholder={
                  !selectedCycle
                    ? t("filters.pickCycleFirst")
                    : needsOptionFilter && !selectedOptionId
                      ? t("filters.pickOptionFirst")
                      : t("filters.classesPlaceholder")
                }
                searchPlaceholder={t("filters.classSearch")}
                selectedCountLabel={(count) =>
                  t("filters.classCount", { count })
                }
                maxCount={1}
                showSelectAll
                disabled={!classesReady || classMultiOptions.length === 0}
              />
              {classesReady && classMultiOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {needsOptionFilter
                    ? t("filters.noClassesInOption")
                    : t("filters.noClassesInCycle")}
                </p>
              ) : null}
            </div>
          </div>
        )}

        {(role === "admin" || role === "parent") && (
          <div className="w-full min-w-[200px] sm:w-auto">
            <Combobox
              label={t("filters.student")}
              items={filteredStudents.map((s) => ({
                value: String(s.studentid),
                label: `${s.username} ${s.nom}`,
              }))}
              value={selectedStudentId ? String(selectedStudentId) : ""}
              onChange={setSelectedStudentId}
              placeholder={t("filters.studentPlaceholder")}
            />
          </div>
        )}

        {selectedClassIds.length > 0 && (
          <div className="w-full min-w-[180px] sm:w-auto">
            <Combobox
              label={t("filters.period")}
              items={sortedPeriods.map((p) => ({
                value: p,
                label: p,
              }))}
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              placeholder={t("filters.periodPlaceholder")}
            />
          </div>
        )}

        {selectedClassIds.length > 0 && (
          <div className="w-full min-w-[120px] sm:w-auto">
            <Combobox
              label={t("filters.year")}
              items={years.map((y) => ({
                value: y,
                label: y,
              }))}
              value={selectedYear}
              onChange={setSelectedYear}
              placeholder={t("filters.yearPlaceholder")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
