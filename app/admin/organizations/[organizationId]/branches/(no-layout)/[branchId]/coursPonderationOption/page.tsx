"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Layout, LayoutBody } from "@/components/custom/layout";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  IconAdjustments,
  IconCheck,
  IconSearch,
  IconSettings,
  IconAlertTriangle,
  IconTrash,
  IconGitMerge,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCoursPonderationOptionPageDataAction,
  saveCoursOptionPonderationAction,
  deleteCoursOptionPonderationAction,
  mergeCoursOptionPonderationAction,
} from "./cours-ponderation-option.action";
import { useBranchRouteGuard } from "@/hooks/use-branch-route-guard";
import { cycleLabel, type Cycle } from "@/lib/cycle";
import {
  getClassLevelLabel,
  getSecondaryPonderationLevels,
} from "@/lib/class-structure";
import { DEFAULT_PONDERATION_LEVEL } from "@/lib/course-ponderation-shared";
import { MultiSelect } from "../paiement/components/MultiSelect";

type PageData = NonNullable<
  Awaited<ReturnType<typeof getCoursPonderationOptionPageDataAction>>[0]
>;
type Ponderation = PageData["ponderations"][number];
type OptionRow = PageData["options"][number];
type CourseRow = PageData["cours"][number];

export default function CoursPonderationOptionPage() {
  useBranchRouteGuard({ routeSuffix: "/coursPonderationOption" });
  const t = useTranslations("teaching.ponderation");
  const tc = useTranslations("common");
  const locale = useLocale();

  const [data, setData] = useState<PageData | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | "">("");
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(
    () =>
      startTransition(async () => {
        const [result, error] = await getCoursPonderationOptionPageDataAction();
        if (error || !result) {
          toast.error(error?.message ?? t("loadFailed"));
          return;
        }
        setData(result);
        const first = result.options[0];
        setSelectedOptionId(first?.id ?? "");
        setSelectedOptionIds(first?.id ? [first.id] : []);
        setSelectedCycle(first?.cycle ?? result.cycles[0] ?? "");
      }),
    [],
  );

  const cycleOptions = useMemo(() => {
    if (!data) return [];
    if (selectedCycle) {
      const filtered = data.options.filter(
        (option) => option.cycle === selectedCycle,
      );
      if (filtered.length) return filtered;
    }
    return data.options;
  }, [data, selectedCycle]);

  const selectedOption = cycleOptions.find(
    (option) => option.id === selectedOptionId,
  ) ?? cycleOptions[0];
  const activeOptionId = selectedOption?.id ?? selectedOptionId;
  const isLevelWeighted = selectedOption?.isLevelWeighted ?? false;
  const activeCycle = selectedOption?.cycle ?? selectedCycle;
  const isSecondary = activeCycle === "SECONDAIRE";
  const usesLevelOptionGroup =
    !isSecondary &&
    (isLevelWeighted ||
      activeCycle === "PRIMAIRE" ||
      activeCycle === "MATERNELLE");
  const secondaryLevels = useMemo(() => {
    if (!isSecondary) return [];
    return getSecondaryPonderationLevels({
      educationSystem: data?.educationSystem,
      option: selectedOption,
    });
  }, [data?.educationSystem, isSecondary, selectedOption]);
  const activeOptionIds = useMemo(() => {
    if (usesLevelOptionGroup) {
      const valid = selectedOptionIds.filter((id) =>
        cycleOptions.some((option) => option.id === id),
      );
      if (valid.length) return valid;
      return cycleOptions[0] ? [cycleOptions[0].id] : [];
    }
    return activeOptionId ? [activeOptionId] : [];
  }, [usesLevelOptionGroup, selectedOptionIds, cycleOptions, activeOptionId]);
  const selectedOptions = useMemo(
    () =>
      cycleOptions.filter((option) => activeOptionIds.includes(option.id)),
    [cycleOptions, activeOptionIds],
  );
  const activeLevels =
    isSecondary && selectedLevels.length > 0
      ? selectedLevels
      : [DEFAULT_PONDERATION_LEVEL];
  const ponderationTargets = useMemo(
    () =>
      activeOptionIds.flatMap((optionId) =>
        activeLevels.map((level) => ({ optionId, level })),
      ),
    [activeOptionIds, activeLevels],
  );
  const map = useMemo(
    () =>
      new Map(
        (data?.ponderations ?? []).map((item) => [
          `${item.optionId}:${item.coursId}:${item.level ?? ""}`,
          item,
        ]),
      ),
    [data],
  );
  const rows = useMemo(() => {
    const values = (data?.cours ?? []).map((course) => {
      const byTarget = ponderationTargets.map(({ optionId, level }) =>
        map.get(`${optionId}:${course.id}:${level}`),
      );
      const specifics = byTarget.filter(Boolean);
      const configured =
        ponderationTargets.length > 0 &&
        specifics.length === ponderationTargets.length;
      const ponderation = specifics[0];
      return {
        course,
        ponderation,
        configured,
      };
    });
    const filtered = values.filter(({ course, configured }) => {
      const matchesSearch = `${course.codeCours} ${course.nameCours}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus =
        status === "all" ||
        (status === "configured" ? configured : !configured);
      return matchesSearch && matchesStatus;
    });
    return filtered.sort((a, b) =>
      sort === "weight"
        ? (b.ponderation?.ponderation ?? -1) -
          (a.ponderation?.ponderation ?? -1)
        : a.course.nameCours.localeCompare(b.course.nameCours),
    );
  }, [data, map, search, ponderationTargets, sort, status]);

  const configured =
    data?.cours.filter((course) =>
      ponderationTargets.every(({ optionId, level }) =>
        map.has(`${optionId}:${course.id}:${level}`),
      ),
    ).length ?? 0;
  const missing = (data?.cours.length ?? 0) - configured;
  const weights = (data?.ponderations ?? [])
    .filter((item) =>
      ponderationTargets.some(
        ({ optionId, level }) =>
          item.optionId === optionId &&
          (item.level ?? DEFAULT_PONDERATION_LEVEL) === level,
      ),
    )
    .map((item) => item.ponderation);
  const average = weights.length
    ? weights.reduce((sum, value) => sum + value, 0) / weights.length
    : 0;

  const mergePlan = useMemo(() => {
    if (!data || ponderationTargets.length < 2) return null;
    const courseCount = data.cours.length;
    if (!courseCount) return null;

    const ranked = ponderationTargets.map((target) => {
      const configuredCount = data.cours.filter((course) =>
        map.has(`${target.optionId}:${course.id}:${target.level}`),
      ).length;
      const option = cycleOptions.find((item) => item.id === target.optionId);
      const label = usesLevelOptionGroup
        ? (option?.displayName ?? t("levelDefault"))
        : target.level
          ? getClassLevelLabel("SECONDAIRE", target.level, data.educationSystem)
          : t("allLevels");
      return { ...target, configuredCount, label };
    });
    const source = [...ranked].sort(
      (a, b) => b.configuredCount - a.configuredCount,
    )[0];
    if (!source || source.configuredCount === 0) return null;
    const destinations = ranked.filter(
      (target) =>
        (target.optionId !== source.optionId || target.level !== source.level) &&
        target.configuredCount < source.configuredCount,
    );
    if (!destinations.length) return null;
    return { source, destinations };
  }, [
    data,
    ponderationTargets,
    map,
    cycleOptions,
    usesLevelOptionGroup,
  ]);

  function save(courseId: string, value: number) {
    const isHalfStep =
      Number.isFinite(value) &&
      Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
    if (!isHalfStep || value < 0 || value > 100 || !data) {
      toast.error(t("invalidWeight"));
      return;
    }
    if (!ponderationTargets.length) {
      toast.error(t("selectLevelRequired"));
      return;
    }
    const previousRows = ponderationTargets.map(({ optionId, level }) =>
      map.get(`${optionId}:${courseId}:${level}`),
    );
    const optimisticRows: Ponderation[] = ponderationTargets.map(
      ({ optionId, level }, index) => ({
        id:
          previousRows[index]?.id ??
          `temp-${courseId}-${optionId}-${level || "all"}`,
        coursId: courseId,
        optionId,
        level,
        ponderation: value,
        updatedAt: new Date(),
      }),
    );
    setData((current) => {
      if (!current) return current;
      const without = current.ponderations.filter(
        (item) =>
          !(
            item.coursId === courseId &&
            ponderationTargets.some(
              ({ optionId, level }) =>
                item.optionId === optionId &&
                (item.level ?? DEFAULT_PONDERATION_LEVEL) === level,
            )
          ),
      );
      return { ...current, ponderations: [...without, ...optimisticRows] };
    });
    setSavingId(courseId);
    startTransition(async () => {
      const [saved, error] = await saveCoursOptionPonderationAction({
        coursId: courseId,
        optionId: activeOptionIds[0],
        optionIds: activeOptionIds,
        ponderation: value,
        levels: activeLevels,
      });
      setSavingId(null);
      if (error || !saved) {
        setData((current) => {
          if (!current) return current;
          const withoutOptimistic = current.ponderations.filter(
            (item) =>
              !optimisticRows.some((row) => row.id === item.id),
          );
          return {
            ...current,
            ponderations: [
              ...withoutOptimistic,
              ...previousRows.filter((row): row is Ponderation => Boolean(row)),
            ],
          };
        });
        toast.error(error?.message ?? t("saveFailed"));
        return;
      }
      setData((current) => {
        if (!current) return current;
        const withoutOptimistic = current.ponderations.filter(
          (item) => !optimisticRows.some((row) => row.id === item.id),
        );
        return {
          ...current,
          ponderations: [...withoutOptimistic, ...saved],
        };
      });
      toast.success(
        activeOptionIds.length > 1
          ? t("savedMulti", { count: activeOptionIds.length })
          : t("saved"),
      );
    });
  }

  function cancel(courseId: string) {
    if (!data) return;
    const previousRows = ponderationTargets
      .map(({ optionId, level }) =>
        map.get(`${optionId}:${courseId}:${level}`),
      )
      .filter((row): row is Ponderation => row != null && !row.id.startsWith("temp-"));
    if (!previousRows.length) {
      toast.error(t("nothingToCancel"));
      return;
    }

    setData((current) =>
      current
        ? {
            ...current,
            ponderations: current.ponderations.filter(
              (item) => !previousRows.some((row) => row.id === item.id),
            ),
          }
        : current,
    );
    setSavingId(courseId);
    startTransition(async () => {
      const [, error] = await deleteCoursOptionPonderationAction({
        coursId: courseId,
        optionId: activeOptionIds[0],
        optionIds: activeOptionIds,
        levels: activeLevels,
      });
      setSavingId(null);
      if (error) {
        setData((current) =>
          current
            ? {
                ...current,
                ponderations: [...current.ponderations, ...previousRows],
              }
            : current,
        );
        toast.error(error.message ?? t("cancelFailed"));
        return;
      }
      toast.success(t("cancelled"));
    });
  }

  function mergeFromConfigured() {
    if (!data || !mergePlan) return;
    const { source, destinations } = mergePlan;
    const sourceRows = (data.cours ?? [])
      .map((course) =>
        map.get(`${source.optionId}:${course.id}:${source.level}`),
      )
      .filter((row): row is Ponderation => Boolean(row));
    if (!sourceRows.length) {
      toast.error(t("nothingToMerge"));
      return;
    }

    const previousRows = destinations.flatMap((target) =>
      sourceRows.map((row) =>
        map.get(`${target.optionId}:${row.coursId}:${target.level}`),
      ),
    );
    const optimisticRows: Ponderation[] = destinations.flatMap((target) =>
      sourceRows.map((row) => {
        const existing = map.get(
          `${target.optionId}:${row.coursId}:${target.level}`,
        );
        return {
          id:
            existing?.id ??
            `temp-merge-${row.coursId}-${target.optionId}-${target.level || "all"}`,
          coursId: row.coursId,
          optionId: target.optionId,
          level: target.level,
          ponderation: row.ponderation,
          updatedAt: new Date(),
        };
      }),
    );

    setData((current) => {
      if (!current) return current;
      const without = current.ponderations.filter(
        (item) =>
          !optimisticRows.some(
            (row) =>
              item.coursId === row.coursId &&
              item.optionId === row.optionId &&
              (item.level ?? DEFAULT_PONDERATION_LEVEL) === row.level,
          ),
      );
      return { ...current, ponderations: [...without, ...optimisticRows] };
    });
    setSavingId("merge");
    startTransition(async () => {
      const [saved, error] = await mergeCoursOptionPonderationAction({
        sourceOptionId: source.optionId,
        sourceLevel: source.level,
        targets: destinations.map((target) => ({
          optionId: target.optionId,
          level: target.level,
        })),
      });
      setSavingId(null);
      if (error || !saved) {
        setData((current) => {
          if (!current) return current;
          const withoutOptimistic = current.ponderations.filter(
            (item) => !optimisticRows.some((row) => row.id === item.id),
          );
          return {
            ...current,
            ponderations: [
              ...withoutOptimistic,
              ...previousRows.filter((row): row is Ponderation => Boolean(row)),
            ],
          };
        });
        toast.error(error?.message ?? t("mergeFailed"));
        return;
      }
      setData((current) => {
        if (!current) return current;
        const withoutOptimistic = current.ponderations.filter(
          (item) => !optimisticRows.some((row) => row.id === item.id),
        );
        return {
          ...current,
          ponderations: [...withoutOptimistic, ...saved],
        };
      });
      toast.success(
        t("merged", {
          source: source.label,
          destinations: destinations.map((target) => target.label).join(", "),
        }),
      );
    });
  }

  if (!data) {
    return (
      <Layout>
        <LayoutBody className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </LayoutBody>
      </Layout>
    );
  }

  return (
    <BranchPageShell
      title={t("title")}
          description={t("year", {
            year: data.schoolYear?.nameYear ?? t("yearMissing"),
          })}
          badge={
            <Badge variant="outline-primary" icon={<IconAdjustments size={14} />}>
              {t("badge")}
            </Badge>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!mergePlan || savingId === "merge"}
                onClick={mergeFromConfigured}
                title={
                  mergePlan
                    ? t("mergeTitle", {
                        source: mergePlan.source.label,
                        destinations: mergePlan.destinations
                          .map((target) => target.label)
                          .join(", "),
                      })
                    : t("mergeHint")
                }
              >
                <IconGitMerge className="mr-2 size-4" />
                {mergePlan
                  ? t("mergeFrom", { label: mergePlan.source.label })
                  : t("merge")}
              </Button>
              <Button variant="outline" onClick={() => setStatus("missing")}>
                <IconSettings className="mr-2 size-4" />
                {t("configureMissing")}
              </Button>
            </div>
          }
    >
      <Card className="space-y-4 p-4">
          <div
            className={`grid gap-4 ${
              data.cycles.length > 1
                ? isSecondary
                  ? "lg:grid-cols-2 xl:grid-cols-4"
                  : "lg:grid-cols-[1fr_1fr_1fr]"
                : isSecondary
                  ? "lg:grid-cols-3"
                  : "lg:grid-cols-[1fr_1fr]"
            }`}
          >
            {data.cycles.length > 1 ? (
              <div>
                <label className="text-sm font-medium">{t("cycle")}</label>
                <Select
                  value={selectedCycle || undefined}
                  onValueChange={(value) => {
                    const cycle = value as Cycle;
                    setSelectedCycle(cycle);
                    const first = data.options.find(
                      (option) => option.cycle === cycle,
                    );
                    setSelectedOptionId(first?.id ?? "");
                    setSelectedOptionIds(first?.id ? [first.id] : []);
                    setSelectedLevels([]);
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={t("selectCycle")} />
                  </SelectTrigger>
                  <SelectContent>
                    {data.cycles.map((cycle) => (
                      <SelectItem key={cycle} value={cycle}>
                        {cycleLabel(cycle)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {usesLevelOptionGroup ? (
              <div>
                <label className="text-sm font-medium">{t("levels")}</label>
                <div className="mt-2">
                  <MultiSelect
                    options={cycleOptions.map((option) => ({
                      value: option.id,
                      label: option.displayName,
                    }))}
                    value={activeOptionIds}
                    onValueChange={(ids) => {
                      const next = ids.length
                        ? ids
                        : cycleOptions[0]
                          ? [cycleOptions[0].id]
                          : [];
                      setSelectedOptionIds(next);
                      setSelectedOptionId(next[0] ?? "");
                    }}
                    placeholder={t("selectLevels")}
                    searchable
                    maxCount={2}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t("multiLevelHint")}
                </p>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">
                  {isLevelWeighted ? t("level") : t("activeOption")}
                </label>
                <Select
                  value={activeOptionId || undefined}
                  onValueChange={(value) => {
                    setSelectedOptionId(value);
                    setSelectedOptionIds([value]);
                    setSelectedLevels([]);
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue
                      placeholder={
                        isLevelWeighted
                          ? t("selectLevel")
                          : t("selectOption")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {cycleOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isSecondary ? (
              <div>
                <label className="text-sm font-medium">{t("levels")}</label>
                <div className="mt-2">
                  <MultiSelect
                    options={secondaryLevels.map((level) => ({
                      value: level,
                      label: getClassLevelLabel(
                        "SECONDAIRE",
                        level,
                        data.educationSystem,
                      ),
                    }))}
                    value={selectedLevels}
                    onValueChange={setSelectedLevels}
                    placeholder={t("allLevels")}
                    searchable
                    maxCount={2}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t("secondaryLevelHint")}
                </p>
              </div>
            ) : null}
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{t("activeContext")}</p>
              <p className="text-muted-foreground">
                {t("section")} : {selectedOption?.section?.nameSection ?? t("allSections")}
              </p>
              <p className="truncate text-muted-foreground">
                {t("classes")} :{" "}
                {selectedOptions
                  .flatMap((option) => option.classe.map((item) => item.nameClasse))
                  .filter((name, index, names) => names.indexOf(name) === index)
                  .join(", ") || t("noClass")}
              </p>
              {usesLevelOptionGroup ? (
                <p className="mt-1 text-muted-foreground">
                  {activeOptionIds.length > 1
                    ? t("targetedLevels", {
                        levels: selectedOptions
                          .map((option) => option.displayName)
                          .join(", "),
                      })
                    : activeCycle === "MATERNELLE"
                      ? t("maternelleHint")
                      : t("primaireHint")}
                </p>
              ) : isSecondary ? (
                <p className="mt-1 text-muted-foreground">
                  {selectedLevels.length
                    ? t("targetedLevels", {
                        levels: selectedLevels
                          .map((level) =>
                            getClassLevelLabel(
                              "SECONDAIRE",
                              level,
                              data.educationSystem,
                            ),
                          )
                          .join(", "),
                      })
                    : t("commonWeighting")}
                </p>
              ) : null}
              {mergePlan ? (
                <p className="mt-2 text-xs text-primary">
                  {t("mergeProposal", {
                    source: mergePlan.source.label,
                    count: mergePlan.source.configuredCount,
                    destinations: mergePlan.destinations
                      .map((target) => target.label)
                      .join(", "),
                  })}
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary title={t("configured")} value={configured} tone="success" />
          <Summary
            title={t("missing")}
            value={missing}
            tone={missing ? "warning" : "success"}
          />
          <Summary title={t("average")} value={average.toFixed(1)} />
          <Summary title={t("total")} value={data.cours.length} />
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search")}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="lg:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="configured">{t("statusConfigured")}</SelectItem>
                <SelectItem value="missing">{t("statusMissing")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="lg:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t("sortByCourse")}</SelectItem>
                <SelectItem value="weight">{t("sortByWeight")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] table-fixed text-sm">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[24%]" />
                <col className="w-[22%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {t("columnCourse")}
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {isLevelWeighted ? t("columnLevelClasses") : t("columnOptionClasses")}
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {t("columnWeight")}
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {tc("status")}
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {t("columnModified")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ course, ponderation, configured }) => (
                  <PonderationRow
                    key={course.id}
                    course={course}
                    option={selectedOption}
                    optionLabel={
                      selectedOptions
                        .map((option) => option.displayName)
                        .join(", ") || undefined
                    }
                    classesLabel={
                      selectedOptions
                        .flatMap((option) =>
                          option.classe.map((item) => item.nameClasse),
                        )
                        .filter(
                          (name, index, names) => names.indexOf(name) === index,
                        )
                        .join(", ") || undefined
                    }
                    ponderation={ponderation}
                    configured={configured}
                    saving={savingId === course.id}
                    onSave={save}
                    onCancel={cancel}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-3 md:hidden">
            {rows.map(({ course, ponderation, configured }) => (
              <PonderationCard
                key={course.id}
                course={course}
                ponderation={ponderation}
                configured={configured}
                saving={savingId === course.id}
                onSave={save}
                onCancel={cancel}
              />
            ))}
          </div>

          {!rows.length && (
            <div className="p-10 text-center">
              <IconAlertTriangle className="mx-auto mb-2 size-8 text-muted-foreground" />
              <p className="font-medium">{t("emptyTitle")}</p>
              <Button
                variant="link"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
              >
                {t("resetFilters")}
              </Button>
            </div>
          )}
        </Card>
    </BranchPageShell>
  );
}

function Summary({
  title,
  value,
  tone,
}: {
  title: string;
  value: string | number;
  tone?: "success" | "warning";
}) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          tone === "warning"
            ? "text-amber-600"
            : tone === "success"
              ? "text-emerald-600"
              : ""
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function WeightEditor({
  courseId,
  value,
  configured,
  saving,
  onSave,
  onCancel,
}: {
  courseId: string;
  value?: number;
  configured: boolean;
  saving: boolean;
  onSave: (id: string, value: number) => void;
  onCancel: (id: string) => void;
}) {
  const t = useTranslations("teaching.ponderation");
  const [draft, setDraft] = useState(String(value ?? 1));
  useEffect(() => setDraft(String(value ?? 1)), [value]);
  const numeric = Number(draft);
  const maxPeriode = Number.isFinite(numeric) ? numeric * 10 : null;

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <Input
        className="h-8 w-20 shrink-0"
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8 shrink-0 px-2"
        disabled={saving || Number(draft) === value}
        onClick={() => onSave(courseId, Number(draft))}
      >
        {saving ? "..." : <IconCheck className="size-4" />}
      </Button>
      {configured ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 shrink-0 px-2 text-destructive hover:text-destructive"
          disabled={saving}
          title={t("cancelWeightTitle")}
          onClick={() => onCancel(courseId)}
        >
          <IconTrash className="size-4" />
        </Button>
      ) : null}
      {maxPeriode != null ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("maxPerPeriod", { value: maxPeriode })}
        </span>
      ) : null}
    </div>
  );
}

function PonderationRow({
  course,
  option,
  optionLabel: optionLabelProp,
  classesLabel: classesLabelProp,
  ponderation,
  configured,
  saving,
  onSave,
  onCancel,
}: {
  course: CourseRow;
  option?: OptionRow;
  optionLabel?: string;
  classesLabel?: string;
  ponderation?: Ponderation;
  configured: boolean;
  saving: boolean;
  onSave: (id: string, value: number) => void;
  onCancel: (id: string) => void;
}) {
  const t = useTranslations("teaching.ponderation");
  const locale = useLocale();
  const classesLabel =
    classesLabelProp ||
    option?.classe.map((item) => item.nameClasse).join(", ") ||
    t("noClass");
  const optionLabel =
    optionLabelProp || option?.displayName || option?.nameOption || "—";

  return (
    <tr
      className={`border-t ${
        !configured ? "bg-amber-50/40 dark:bg-amber-950/10" : ""
      }`}
    >
      <td className="px-3 py-2 align-middle">
        <span className="block truncate font-medium" title={course.nameCours}>
          {course.nameCours}
        </span>
      </td>
      <td className="px-3 py-2 align-middle">
        <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
          <span className="shrink-0 font-medium text-foreground">
            {optionLabel}
          </span>
          <span
            className="truncate text-xs text-muted-foreground"
            title={classesLabel}
          >
            {classesLabel}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 align-middle">
        <WeightEditor
          courseId={course.id}
          value={ponderation?.ponderation}
          configured={configured}
          saving={saving}
          onSave={onSave}
          onCancel={onCancel}
        />
      </td>
      <td className="px-3 py-2 align-middle whitespace-nowrap">
        <Badge variant={configured ? "success" : "warning"}>
          {configured ? t("configuredBadge") : t("missingBadge")}
        </Badge>
      </td>
      <td className="px-3 py-2 align-middle whitespace-nowrap text-muted-foreground">
        {ponderation
          ? new Date(ponderation.updatedAt).toLocaleString(locale, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </td>
    </tr>
  );
}

function PonderationCard({
  course,
  ponderation,
  configured,
  saving,
  onSave,
  onCancel,
}: {
  course: CourseRow;
  ponderation?: Ponderation;
  configured: boolean;
  saving: boolean;
  onSave: (id: string, value: number) => void;
  onCancel: (id: string) => void;
}) {
  const t = useTranslations("teaching.ponderation");
  const locale = useLocale();
  return (
    <Card className={`space-y-3 p-4 ${!configured ? "border-amber-300" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{course.nameCours}</p>
          <p className="text-xs text-muted-foreground">{course.codeCours}</p>
        </div>
        <Badge variant={configured ? "success" : "warning"}>
          {configured ? t("configuredBadge") : t("missingBadge")}
        </Badge>
      </div>
      <WeightEditor
        courseId={course.id}
        value={ponderation?.ponderation}
        configured={configured}
        saving={saving}
        onSave={onSave}
        onCancel={onCancel}
      />
      {ponderation ? (
        <p className="text-xs text-muted-foreground">
          {t("modifiedOn", {
            date: new Date(ponderation.updatedAt).toLocaleString(locale, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </p>
      ) : null}
    </Card>
  );
}
