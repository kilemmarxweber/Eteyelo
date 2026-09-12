"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import { MultiSelect } from "../../paiement/components/MultiSelect";
import { compareClassesByLevel } from "@/lib/class-structure";
import {
  CYCLE_SORT_ORDER,
  cycleLabel,
  normalizeCycle,
  type Cycle,
} from "@/lib/cycle";

const NO_OPTION_VALUE = "__none__";

export type AttendanceReportClass = {
  id: string;
  name: string;
  nameClasse: string;
  codeClasse: string;
  level?: string | null;
  parallel?: string | null;
  cycle?: string | null;
  option?: {
    id: string;
    nameOption: string;
    codeOption: string;
    cycle?: string | null;
  } | null;
};

function classeCycle(classe: AttendanceReportClass): Cycle {
  return normalizeCycle(classe.cycle || classe.option?.cycle);
}

function optionFilterValue(classe: AttendanceReportClass) {
  return `${classeCycle(classe)}::${classe.option?.id || NO_OPTION_VALUE}`;
}

function sortReportClasses(classes: AttendanceReportClass[]) {
  return [...classes].sort((left, right) => {
    const cycle =
      CYCLE_SORT_ORDER[classeCycle(left)] - CYCLE_SORT_ORDER[classeCycle(right)];
    if (cycle !== 0) return cycle;
    const option = (left.option?.nameOption || "").localeCompare(
      right.option?.nameOption || "",
      "fr",
    );
    if (option !== 0) return option;
    return compareClassesByLevel(left, right);
  });
}

export function useAttendanceClassFilters(classes: AttendanceReportClass[]) {
  const t = useTranslations("attendance");
  const [cycleFilter, setCycleFilter] = useState<string[]>([]);
  const [optionFilter, setOptionFilter] = useState<string[]>([]);
  const [classeIds, setClasseIds] = useState<string[]>([]);

  const sortedClasses = useMemo(() => sortReportClasses(classes), [classes]);

  const cycleOptions = useMemo(() => {
    const values = new Set(sortedClasses.map((classe) => classeCycle(classe)));
    return [...values]
      .sort((a, b) => CYCLE_SORT_ORDER[a] - CYCLE_SORT_ORDER[b])
      .map((cycle) => ({
        value: cycle,
        label: cycleLabel(cycle),
      }));
  }, [sortedClasses]);

  const classesAfterCycle = useMemo(() => {
    if (cycleFilter.length === 0) return sortedClasses;
    const selected = new Set(cycleFilter);
    return sortedClasses.filter((classe) => selected.has(classeCycle(classe)));
  }, [cycleFilter, sortedClasses]);

  const optionOptions = useMemo(() => {
    const includeCycle = cycleFilter.length !== 1;
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string; cycle: Cycle }> = [];
    for (const classe of classesAfterCycle) {
      const value = optionFilterValue(classe);
      if (seen.has(value)) continue;
      seen.add(value);
      const optionName =
        classe.option?.nameOption || t("filters.noOption");
      const cycle = classeCycle(classe);
      options.push({
        value,
        cycle,
        label: includeCycle
          ? `${cycleLabel(cycle)} · ${optionName}`
          : optionName,
      });
    }
    return options.sort((a, b) => {
      const cycle = CYCLE_SORT_ORDER[a.cycle] - CYCLE_SORT_ORDER[b.cycle];
      if (cycle !== 0) return cycle;
      return a.label.localeCompare(b.label, "fr");
    });
  }, [classesAfterCycle, cycleFilter.length, t]);

  const filteredClasses = useMemo(() => {
    if (optionFilter.length === 0) return classesAfterCycle;
    const selected = new Set(optionFilter);
    return classesAfterCycle.filter((classe) =>
      selected.has(optionFilterValue(classe)),
    );
  }, [classesAfterCycle, optionFilter]);

  const classOptions = useMemo(() => {
    const visible = new Map(
      filteredClasses.map((classe) => [classe.id, classe] as const),
    );
    for (const id of classeIds) {
      const classe = sortedClasses.find((item) => item.id === id);
      if (classe) visible.set(id, classe);
    }
    return sortReportClasses([...visible.values()]).map((classe) => ({
      value: classe.id,
      label: classe.name,
    }));
  }, [classeIds, filteredClasses, sortedClasses]);

  useEffect(() => {
    const allowed = new Set(optionOptions.map((option) => option.value));
    setOptionFilter((current) => {
      const next = current.filter((value) => allowed.has(value));
      return next.length === current.length ? current : next;
    });
  }, [optionOptions]);

  useEffect(() => {
    const allowed = new Set(filteredClasses.map((classe) => classe.id));
    setClasseIds((current) => {
      const next = current.filter((id) => allowed.has(id));
      return next.length === current.length ? current : next;
    });
  }, [filteredClasses]);

  const resolvedClasseIds = useMemo((): string[] | null => {
    if (classeIds.length > 0) return classeIds;
    if (cycleFilter.length === 0 && optionFilter.length === 0) return null;
    return filteredClasses.map((classe) => classe.id);
  }, [classeIds, cycleFilter.length, filteredClasses, optionFilter.length]);

  const scopeKey =
    resolvedClasseIds == null ? "all" : resolvedClasseIds.join(",");

  return {
    cycleFilter,
    setCycleFilter,
    optionFilter,
    setOptionFilter,
    classeIds,
    setClasseIds,
    cycleOptions,
    optionOptions,
    classOptions,
    resolvedClasseIds,
    scopeKey,
  };
}

export function AttendanceClassFilterBar({
  filter,
}: {
  filter: ReturnType<typeof useAttendanceClassFilters>;
}) {
  return (
    <AttendanceClassMultiFilter
      cycleFilter={filter.cycleFilter}
      onCycleChange={filter.setCycleFilter}
      optionFilter={filter.optionFilter}
      onOptionChange={filter.setOptionFilter}
      classeIds={filter.classeIds}
      onClasseChange={filter.setClasseIds}
      cycleOptions={filter.cycleOptions}
      optionOptions={filter.optionOptions}
      classOptions={filter.classOptions}
    />
  );
}

export function AttendanceClassMultiFilter({
  cycleFilter,
  onCycleChange,
  optionFilter,
  onOptionChange,
  classeIds,
  onClasseChange,
  cycleOptions,
  optionOptions,
  classOptions,
}: {
  cycleFilter: string[];
  onCycleChange: (value: string[]) => void;
  optionFilter: string[];
  onOptionChange: (value: string[]) => void;
  classeIds: string[];
  onClasseChange: (value: string[]) => void;
  cycleOptions: Array<{ value: string; label: string }>;
  optionOptions: Array<{ value: string; label: string }>;
  classOptions: Array<{ value: string; label: string }>;
}) {
  const t = useTranslations("attendance");

  return (
    <div className="grid w-full gap-2 sm:grid-cols-3">
      <div className="space-y-1">
        <Label className="text-xs">{t("filters.cycle")}</Label>
        <MultiSelect
          options={cycleOptions}
          value={cycleFilter}
          onValueChange={onCycleChange}
          placeholder={t("filters.allCycles")}
          selectedCountLabel={(count) => t("filters.cycleCount", { count })}
          maxCount={1}
          showSelectAll
          className="h-9 min-h-9"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("filters.option")}</Label>
        <MultiSelect
          options={optionOptions}
          value={optionFilter}
          onValueChange={onOptionChange}
          placeholder={t("filters.allOptions")}
          selectedCountLabel={(count) => t("filters.optionCount", { count })}
          maxCount={1}
          showSelectAll
          className="h-9 min-h-9"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("filters.class")}</Label>
        <MultiSelect
          options={classOptions}
          value={classeIds}
          onValueChange={onClasseChange}
          placeholder={t("filters.allClassesLong")}
          selectedCountLabel={(count) => t("filters.classCount", { count })}
          maxCount={1}
          showSelectAll
          className="h-9 min-h-9"
        />
      </div>
    </div>
  );
}
