"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Layout, LayoutBody } from "@/components/custom/layout";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import {
  IconBooks,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconUserOff,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  getTeachingWorkspaceAction,
  getTeachingClassCoursesAction,
  removeQuickAssignmentsAction,
  saveQuickAssignmentsAction,
  updateTeachingWeeklyHoursAction,
} from "./teaching.action";
import type { Cycle } from "@/lib/cycle";
import { compareClassesByLevel } from "@/lib/class-structure";
import { CRENEAU_WEEKDAY_OPTIONS } from "@/lib/creneau-working-days";
import { MultiSelect } from "../paiement/components/MultiSelect";
import type { TeachingWeekday } from "@/src/interfaces/Teaching";

type Workspace = NonNullable<
  Awaited<ReturnType<typeof getTeachingWorkspaceAction>>[0]
>;
type ClassCourses = NonNullable<
  Awaited<ReturnType<typeof getTeachingClassCoursesAction>>[0]
>;
type ClassTeaching = ClassCourses["teachings"][number];
const PAGE_SIZE = 8;

export default function TeachingWorkspacePage() {
  const t = useTranslations("teaching.assignments");
  const tc = useTranslations("common");
  const [data, setData] = useState<Workspace | null>(null);
  const [classCourses, setClassCourses] = useState<ClassCourses | null>(null);
  const [classCache, setClassCache] = useState<Record<string, ClassCourses>>(
    {},
  );
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [bulkTeacherId, setBulkTeacherId] = useState("");
  const [bulkWeeklyHours, setBulkWeeklyHours] = useState("");
  const [bulkConsecutiveSlots, setBulkConsecutiveSlots] = useState("1");
  const [bulkPreferredDays, setBulkPreferredDays] = useState<TeachingWeekday[]>(
    [],
  );
  const [savingCourseId, setSavingCourseId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(
    () =>
      startTransition(async () => {
        const [result, error] = await getTeachingWorkspaceAction();
        if (error || !result) {
          toast.error(error?.message ?? t("loadFailed"));
          return;
        }
        setData(result);
        setSelectedClassId(result.classes[0]?.id ?? "");
      }),
    [],
  );

  useEffect(() => {
    if (!selectedClassId) {
      setClassCourses(null);
      return;
    }
    const cached = classCache[selectedClassId];
    if (cached) {
      setClassCourses(cached);
      return;
    }
    setClassCourses(null);
    let cancelled = false;
    startTransition(async () => {
      const [result, error] = await getTeachingClassCoursesAction({
        classeId: selectedClassId,
      });
      if (cancelled) return;
      if (error || !result) {
        toast.error(error?.message ?? t("loadCoursesFailed"));
        return;
      }
      setClassCache((current) => ({ ...current, [selectedClassId]: result }));
      setClassCourses(result);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClassId]);

  const courses = classCourses?.courses ?? [];
  const teachings = classCourses?.teachings ?? [];
  const visibleCourseIds = useMemo(
    () => new Set(courses.map((course) => course.id)),
    [courses],
  );
  const currentTeachings = useMemo(
    () =>
      teachings.filter(
        (item) =>
          item.classeId === selectedClassId &&
          item.schoolYearId === data?.schoolYear?.id &&
          item.statusTeaching !== false &&
          visibleCourseIds.has(item.coursId),
      ),
    [data?.schoolYear?.id, selectedClassId, teachings, visibleCourseIds],
  );
  const assignmentMap = useMemo(
    () => new Map(currentTeachings.map((item) => [item.coursId, item])),
    [currentTeachings],
  );
  const assignedCount = assignmentMap.size;
  const unassignedCount = Math.max(0, courses.length - assignedCount);
  const filteredClasses = useMemo(
    () =>
      [...(data?.classes ?? [])]
        .filter((item) =>
          `${item.codeClasse} ${item.nameClasse} ${item.option?.nameOption ?? ""}`
            .toLowerCase()
            .includes(classSearch.toLowerCase()),
        )
        .sort(compareClassesByLevel),
    [classSearch, data],
  );
  const paginatedClasses = filteredClasses.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE,
  );
  const rows = useMemo(
    () =>
      courses.filter((course) => {
        const assignment = assignmentMap.get(course.id);
        return (
          `${course.codeCours} ${course.nameCours}`
            .toLowerCase()
            .includes(courseSearch.toLowerCase()) &&
          (teacherFilter === "all" || assignment?.teacherId === teacherFilter) &&
          (assignmentFilter === "all" ||
            (assignmentFilter === "assigned" ? !!assignment : !assignment))
        );
      }),
    [assignmentFilter, assignmentMap, courseSearch, courses, teacherFilter],
  );
  const selectedAssignedCourses = selectedCourses.filter((id) =>
    assignmentMap.has(id),
  );
  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allVisibleSelected =
    rowIds.length > 0 && rowIds.every((id) => selectedCourses.includes(id));
  const someVisibleSelected = rowIds.some((id) =>
    selectedCourses.includes(id),
  );

  function toggleSelectAllVisible(checked: boolean | "indeterminate") {
    const selectAll = checked === true;
    setSelectedCourses((current) => {
      if (selectAll) {
        return [...new Set([...current, ...rowIds])];
      }
      const remove = new Set(rowIds);
      return current.filter((id) => !remove.has(id));
    });
  }

  const totalUnassigned = (data?.classes ?? []).reduce(
    (sum, classe) =>
      sum + Math.max(0, classe.configuredCount - classe.assignedCount),
    0,
  );

  const selectedClassPreview = data?.classes.find(
    (item) => item.id === selectedClassId,
  );
  const classCycle = selectedClassPreview?.cycle as Cycle | undefined;
  const teachersForClass = useMemo(() => {
    const teachers = data?.teachers ?? [];
    if (!classCycle) return teachers;
    return teachers.filter((teacher) => {
      const cycles = teacher.cycles ?? [];
      return cycles.length === 0 || cycles.includes(classCycle);
    });
  }, [classCycle, data?.teachers]);

  useEffect(() => {
    if (
      bulkTeacherId &&
      bulkTeacherId !== "all" &&
      !teachersForClass.some((teacher) => teacher.id === bulkTeacherId)
    ) {
      setBulkTeacherId("");
    }
    if (
      teacherFilter !== "all" &&
      !teachersForClass.some((teacher) => teacher.id === teacherFilter)
    ) {
      setTeacherFilter("all");
    }
  }, [bulkTeacherId, teacherFilter, teachersForClass]);

  function updateClassTeachings(
    classeId: string,
    nextTeachings: ClassTeaching[],
  ) {
    const visibleIds = new Set(
      (
        classCache[classeId]?.courses ??
        (classeId === selectedClassId ? classCourses?.courses : undefined) ??
        []
      ).map((course) => course.id),
    );
    const assignedCount = new Set(
      nextTeachings
        .filter(
          (item) =>
            item.statusTeaching !== false &&
            (visibleIds.size === 0 || visibleIds.has(item.coursId)),
        )
        .map((item) => item.coursId),
    ).size;
    setData((current) =>
      current
        ? {
            ...current,
            classes: current.classes.map((classe) =>
              classe.id === classeId
                ? {
                    ...classe,
                    assignedCount,
                    ...(visibleIds.size > 0
                      ? { configuredCount: visibleIds.size }
                      : {}),
                  }
                : classe,
            ),
          }
        : current,
    );
    setClassCourses((current) =>
      current?.classeId === classeId
        ? { ...current, teachings: nextTeachings }
        : current,
    );
    setClassCache((current) => {
      const cached = current[classeId];
      if (!cached) return current;
      return { ...current, [classeId]: { ...cached, teachings: nextTeachings } };
    });
  }

  function applyAssignments(
    courseIds: string[],
    teacherId: string,
    weeklyHours?: number,
    consecutiveSlots?: number | null,
    preferredDays?: TeachingWeekday[],
  ) {
    if (!data || !classCourses || !selectedClassId || !teacherId || !courseIds.length)
      return;
    const previous = classCourses.teachings;
    const consecutive =
      consecutiveSlots != null && consecutiveSlots > 1 ? consecutiveSlots : null;
    const days = (preferredDays ?? []).filter(Boolean) as TeachingWeekday[];
    const tempRows: ClassTeaching[] = courseIds.map((coursId) => ({
      id: `temp-${coursId}`,
      classeId: selectedClassId,
      coursId,
      teacherId,
      schoolYearId: data.schoolYear?.id ?? "",
      statusTeaching: true,
      titulaire: false,
      weeklyHours: weeklyHours ?? null,
      consecutiveSlots: consecutive,
      preferredDays: days as ClassTeaching["preferredDays"],
      updatedAt: new Date(),
    }));
    updateClassTeachings(selectedClassId, [
      ...previous.filter(
        (item) =>
          !(
            courseIds.includes(item.coursId) &&
            item.schoolYearId === data.schoolYear?.id
          ),
      ),
      ...tempRows,
    ]);
    setSavingCourseId(courseIds.length === 1 ? courseIds[0] : "bulk");
    startTransition(async () => {
      const [saved, error] = await saveQuickAssignmentsAction({
        classeId: selectedClassId,
        coursIds: courseIds,
        teacherId,
        ...(weeklyHours != null && weeklyHours > 0 ? { weeklyHours } : {}),
        consecutiveSlots: consecutive,
        preferredDays: days,
      });
      setSavingCourseId(null);
      if (error || !saved) {
        updateClassTeachings(selectedClassId, previous);
        toast.error(error?.message ?? t("assignFailed"));
        return;
      }
      updateClassTeachings(selectedClassId, [
        ...previous.filter(
          (item) =>
            !(
              courseIds.includes(item.coursId) &&
              item.schoolYearId === data.schoolYear?.id
            ),
        ),
        ...saved,
      ]);
      setSelectedCourses([]);
      setBulkTeacherId("");
      toast.success(t("coursesAssigned", { count: courseIds.length }));
    });
  }

  function saveWeeklyHours(teachingId: string, coursId: string, value: string) {
    const weeklyHours = Number(value);
    if (!Number.isFinite(weeklyHours) || weeklyHours <= 0) {
      toast.error(t("invalidWeeklyHours"));
      return;
    }
    if (!classCourses || !selectedClassId) return;
    const previous = classCourses.teachings;
    updateClassTeachings(
      selectedClassId,
      previous.map((item) =>
        item.id === teachingId ? { ...item, weeklyHours } : item,
      ),
    );
    setSavingCourseId(coursId);
    startTransition(async () => {
      const [updated, error] = await updateTeachingWeeklyHoursAction({
        teachingId,
        weeklyHours,
      });
      setSavingCourseId(null);
      if (error || !updated) {
        updateClassTeachings(selectedClassId, previous);
        toast.error(error?.message ?? t("updateFailed"));
        return;
      }
      updateClassTeachings(
        selectedClassId,
        previous.map((item) => (item.id === teachingId ? { ...item, ...updated } : item)),
      );
      toast.success(t("weeklyHoursSaved"));
    });
  }

  function savePlacementPrefs(
    teachingId: string,
    coursId: string,
    prefs: {
      consecutiveSlots?: number | null;
      preferredDays?: TeachingWeekday[];
    },
  ) {
    if (!classCourses || !selectedClassId) return;
    const previous = classCourses.teachings;
    const consecutive =
      prefs.consecutiveSlots != null && prefs.consecutiveSlots > 1
        ? prefs.consecutiveSlots
        : null;
    const days = prefs.preferredDays;
    updateClassTeachings(
      selectedClassId,
      previous.map((item) =>
        item.id === teachingId
          ? {
              ...item,
              ...(prefs.consecutiveSlots !== undefined
                ? { consecutiveSlots: consecutive }
                : {}),
              ...(days !== undefined
                ? { preferredDays: days as ClassTeaching["preferredDays"] }
                : {}),
            }
          : item,
      ),
    );
    setSavingCourseId(coursId);
    startTransition(async () => {
      const [updated, error] = await updateTeachingWeeklyHoursAction({
        teachingId,
        ...(prefs.consecutiveSlots !== undefined
          ? { consecutiveSlots: consecutive }
          : {}),
        ...(days !== undefined ? { preferredDays: days } : {}),
      });
      setSavingCourseId(null);
      if (error || !updated) {
        updateClassTeachings(selectedClassId, previous);
        toast.error(error?.message ?? t("updateFailed"));
        return;
      }
      updateClassTeachings(
        selectedClassId,
        previous.map((item) =>
          item.id === teachingId ? { ...item, ...updated } : item,
        ),
      );
      toast.success(t("scheduleConstraintsSaved"));
    });
  }

  function removeAssignments(courseIds: string[]) {
    if (!data || !classCourses || !selectedClassId || !courseIds.length) return;
    const previous = classCourses.teachings;
    updateClassTeachings(
      selectedClassId,
      previous.map((item) =>
        courseIds.includes(item.coursId) &&
        item.schoolYearId === data.schoolYear?.id &&
        item.statusTeaching !== false
          ? { ...item, statusTeaching: false }
          : item,
      ),
    );
    setSavingCourseId(courseIds.length === 1 ? courseIds[0] : "bulk");
    startTransition(async () => {
      const [result, error] = await removeQuickAssignmentsAction({
        classeId: selectedClassId,
        coursIds: courseIds,
      });
      setSavingCourseId(null);
      if (error || !result) {
        updateClassTeachings(selectedClassId, previous);
        toast.error(error?.message ?? t("removeFailed"));
        return;
      }
      setSelectedCourses([]);
      toast.success(t("coursesRemoved", { count: result.removed }));
    });
  }

  if (!data)
    return (
      <Layout>
        <LayoutBody>
          <Skeleton className="h-[70vh] w-full" />
        </LayoutBody>
      </Layout>
    );
  const selectedClass = data.classes.find(
    (item) => item.id === selectedClassId,
  );

  return (
    <BranchPageShell
      title={t("title")}
      description={t("year", {
        year: data.schoolYear?.nameYear ?? t("yearMissing"),
      })}
          badge={
            <Badge variant="outline-primary" icon={<IconUsers size={14} />}>
              {t("badge")}
            </Badge>
          }
          actions={
            <Button
              variant="outline"
              onClick={() => setAssignmentFilter("unassigned")}
            >
              <IconUserOff className="mr-2 size-4" />
              {t("unassigned", { count: totalUnassigned })}
            </Button>
          }
      fixedHeight
      fadedBelow
    >
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="flex min-h-0 flex-col overflow-hidden">
            <div className="border-b p-3">
              <h2 className="font-semibold">{t("classes")}</h2>
              <div className="relative mt-2">
                <IconSearch className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  value={classSearch}
                  onChange={(e) => {
                    setClassSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder={t("searchClass")}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {paginatedClasses.map((classe) => {
                const count = classe.assignedCount;
                const configured = classe.configuredCount;
                return (
                  <button
                    key={classe.id}
                    onClick={() => {
                      setSelectedClassId(classe.id);
                      setSelectedCourses([]);
                    }}
                    className={`mb-1 w-full rounded-lg border p-3 text-left transition ${selectedClassId === classe.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{classe.nameClasse}</span>
                      <Badge
                        variant={
                          configured > 0 && count === configured
                            ? "success"
                            : "warning"
                        }
                      >
                        {count}/{configured}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {classe.option?.section?.nameSection} ·{" "}
                      {classe.option?.nameOption}
                    </p>
                  </button>
                );
              })}
              {!paginatedClasses.length && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {t("noClass")}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between border-t p-2">
              <Button
                size="icon"
                variant="ghost"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                <IconChevronLeft className="size-4" />
              </Button>
              <span className="text-xs">
                {t("page", {
                  current: page + 1,
                  total: Math.max(1, Math.ceil(filteredClasses.length / PAGE_SIZE)),
                })}
              </span>
              <Button
                size="icon"
                variant="ghost"
                disabled={(page + 1) * PAGE_SIZE >= filteredClasses.length}
                onClick={() => setPage((value) => value + 1)}
              >
                <IconChevronRight className="size-4" />
              </Button>
            </div>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <div className="border-b p-4">
              <div className="flex flex-col gap-1">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">
                    {selectedClass?.nameClasse ?? t("selectClass")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("statsAssigned", { count: assignedCount })} ·{" "}
                    {t("statsUnassigned", { count: unassignedCount })}
                    {classCourses
                      ? ` · ${t("statsRows", { count: courses.length })}`
                      : selectedClass
                        ? ` · ${t("statsRows", { count: selectedClass.configuredCount })}`
                        : ""}
                  </p>
                </div>
                {selectedCourses.length > 0 && (
                  <div className="mt-2 flex w-full flex-nowrap items-center gap-2 overflow-x-auto">
                    <TeacherPicker
                      teachers={teachersForClass}
                      value={bulkTeacherId}
                      onChange={setBulkTeacherId}
                      placeholder={t("bulkTeacher")}
                      className="h-9 min-w-[9rem] flex-1"
                    />
                    <Input
                      type="number"
                      min={15}
                      max={600}
                      step={15}
                      value={bulkWeeklyHours}
                      onChange={(e) => setBulkWeeklyHours(e.target.value)}
                      placeholder={t("minutesShort")}
                      className="h-9 w-[4.25rem] shrink-0 px-1.5 text-center tabular-nums"
                      title={t("minutesPerWeekTitle")}
                    />
                    <Select
                      value={bulkConsecutiveSlots}
                      onValueChange={setBulkConsecutiveSlots}
                    >
                      <SelectTrigger
                        className="h-9 w-[5.5rem] shrink-0 px-2"
                        title={t("consecutiveTitle")}
                      >
                        <SelectValue placeholder={t("consecutivePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">{t("consecutive1")}</SelectItem>
                        <SelectItem value="2">{t("consecutive2")}</SelectItem>
                        <SelectItem value="3">{t("consecutive3")}</SelectItem>
                        <SelectItem value="4">{t("consecutive4")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="w-[4.5rem] shrink-0">
                      <MultiSelect
                        options={CRENEAU_WEEKDAY_OPTIONS.map((day) => ({
                          value: day.value,
                          label: day.short,
                        }))}
                        value={bulkPreferredDays}
                        onValueChange={(days) =>
                          setBulkPreferredDays(days as TeachingWeekday[])
                        }
                        placeholder={t("days")}
                        searchable={false}
                        hideSelected
                        selectedCountLabel={(count) => String(count)}
                        className="h-9 px-2"
                      />
                    </div>
                    <Button
                      className="shrink-0"
                      disabled={!bulkTeacherId || savingCourseId === "bulk"}
                      onClick={() => {
                        const hours = Number(bulkWeeklyHours);
                        const consecutive = Number(bulkConsecutiveSlots);
                        applyAssignments(
                          selectedCourses,
                          bulkTeacherId,
                          Number.isFinite(hours) && hours > 0
                            ? hours
                            : undefined,
                          Number.isFinite(consecutive) ? consecutive : 1,
                          bulkPreferredDays,
                        );
                      }}
                    >
                      {t("assign", { count: selectedCourses.length })}
                    </Button>
                    {selectedAssignedCourses.length > 0 && (
                      <Button
                        className="shrink-0"
                        variant="outline"
                        disabled={savingCourseId === "bulk"}
                        onClick={() =>
                          removeAssignments(selectedAssignedCourses)
                        }
                      >
                        <IconX className="mr-2 size-4" />
                        {t("remove", { count: selectedAssignedCourses.length })}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="relative">
                  <IconSearch className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder={t("courseSearchShort")}
                    className="pl-9"
                  />
                </div>
                <TeacherPicker
                  teachers={teachersForClass}
                  value={teacherFilter}
                  onChange={setTeacherFilter}
                  placeholder={t("allTeachers")}
                  allowAll
                  className="w-full"
                />
                <Select
                  value={assignmentFilter}
                  onValueChange={setAssignmentFilter}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allCourses")}</SelectItem>
                    <SelectItem value="assigned">{t("filterAssigned")}</SelectItem>
                    <SelectItem value="unassigned">{t("filterUnassigned")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!rowIds.length || allVisibleSelected}
                    onClick={() => toggleSelectAllVisible(true)}
                  >
                    {rowIds.length > 0
                      ? t("selectAllVisible", { count: rowIds.length })
                      : t("selectAll")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!someVisibleSelected}
                    onClick={() => toggleSelectAllVisible(false)}
                  >
                    {t("deselectAll")}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("autoScheduleHint")}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="sticky top-0 bg-background text-left shadow-sm">
                  <tr>
                    <th className="p-2">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={
                            allVisibleSelected
                              ? true
                              : someVisibleSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={toggleSelectAllVisible}
                          aria-label={t("selectAllAria")}
                          disabled={!rowIds.length}
                        />
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("allRows")}
                        </span>
                      </label>
                    </th>
                    <th className="p-2">{t("courseColumn")}</th>
                    <th className="p-2 w-[11rem]">{t("teacherColumn")}</th>
                    <th className="p-2 w-[4.5rem]">{t("minPerWeek")}</th>
                    <th className="p-2 w-[4.5rem]">{t("consecutiveColumn")}</th>
                    <th className="p-2 w-[4.5rem]">{t("daysColumn")}</th>
                    <th className="p-2 w-[6.5rem]">{t("stateColumn")}</th>
                    <th className="p-2 w-[1%]">{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((course) => {
                    const assignment = assignmentMap.get(course.id);
                    const isSaving = savingCourseId === course.id;
                    return (
                      <tr key={course.id} className="border-t">
                        <td className="p-2">
                          <Checkbox
                            checked={selectedCourses.includes(course.id)}
                            onCheckedChange={(checked) =>
                              setSelectedCourses((current) =>
                                checked
                                  ? [...new Set([...current, course.id])]
                                  : current.filter((id) => id !== course.id),
                              )
                            }
                          />
                        </td>
                        <td className="p-2">
                          <p className="font-medium">{course.nameCours}</p>
                          <p className="text-xs text-muted-foreground">
                            {course.codeCours}
                            {(course as { parentNameCours?: string | null })
                              .parentNameCours
                              ? ` · ${(course as { parentNameCours?: string | null }).parentNameCours}`
                              : ""}
                            {(course as { kind?: string }).kind ===
                            "SCHEDULE_COMPONENT"
                              ? ` · ${t("schedulePost")}`
                              : ""}
                          </p>
                        </td>
                        <td className="p-2">
                          <TeacherPicker
                            teachers={teachersForClass}
                            value={assignment?.teacherId ?? ""}
                            onChange={(teacherId) => {
                              if (!teacherId) {
                                if (assignment) removeAssignments([course.id]);
                                return;
                              }
                              const hours = Number(bulkWeeklyHours);
                              const consecutive = Number(bulkConsecutiveSlots);
                              applyAssignments(
                                [course.id],
                                teacherId,
                                Number.isFinite(hours) && hours > 0
                                  ? hours
                                  : undefined,
                                Number.isFinite(consecutive) ? consecutive : 1,
                                bulkPreferredDays,
                              );
                            }}
                            disabled={isSaving}
                            placeholder={t("assignPlaceholder")}
                            allowClear={Boolean(assignment)}
                            className="h-9 w-full max-w-[11rem]"
                          />
                        </td>
                        <td className="p-2">
                          {assignment ? (
                            <Input
                              type="number"
                              min={15}
                              max={600}
                              step={15}
                              defaultValue={assignment.weeklyHours ?? ""}
                              key={`${assignment.id}-${assignment.weeklyHours ?? "empty"}`}
                              disabled={isSaving}
                              className="h-9 w-[4.25rem] px-1.5 text-center tabular-nums"
                              placeholder="135"
                              title={t("minutesPerWeekField")}
                              onBlur={(e) => {
                                const next = e.target.value;
                                const prev = assignment.weeklyHours;
                                if (
                                  next === "" ||
                                  (prev != null && Number(next) === prev)
                                ) {
                                  return;
                                }
                                saveWeeklyHours(
                                  assignment.id,
                                  course.id,
                                  next,
                                );
                              }}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-2">
                          {assignment ? (
                            <Select
                              value={String(assignment.consecutiveSlots ?? 1)}
                              onValueChange={(value) => {
                                const next = Number(value);
                                const prev = assignment.consecutiveSlots ?? 1;
                                if (next === prev || (next <= 1 && !assignment.consecutiveSlots)) {
                                  return;
                                }
                                savePlacementPrefs(assignment.id, course.id, {
                                  consecutiveSlots: next <= 1 ? null : next,
                                });
                              }}
                              disabled={isSaving}
                            >
                              <SelectTrigger className="h-9 w-[4.25rem] px-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="4">4</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-2">
                          {assignment ? (
                            <MultiSelect
                              options={CRENEAU_WEEKDAY_OPTIONS.map((day) => ({
                                value: day.value,
                                label: day.short,
                              }))}
                              value={(assignment.preferredDays ?? []) as string[]}
                              onValueChange={(days) => {
                                const prev = (assignment.preferredDays ?? []) as string[];
                                if (
                                  prev.length === days.length &&
                                  prev.every((day) => days.includes(day))
                                ) {
                                  return;
                                }
                                savePlacementPrefs(assignment.id, course.id, {
                                  preferredDays: days as TeachingWeekday[],
                                });
                              }}
                              placeholder={t("allDays")}
                              searchable={false}
                              hideSelected
                              selectedCountLabel={(count) => String(count)}
                              disabled={isSaving}
                              className="h-9 max-w-[4.5rem] px-2"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-2">
                          <Badge
                            variant={assignment ? "success" : "warning"}
                            icon={
                              assignment ? (
                                <IconCheck size={13} />
                              ) : (
                                <IconUserOff size={13} />
                              )
                            }
                          >
                            {assignment ? t("assignedBadge") : t("unassignedBadge")}
                          </Badge>
                        </td>
                        <td className="p-2">
                          {assignment ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={isSaving || pending}
                              onClick={() => removeAssignments([course.id])}
                            >
                              <IconX className="mr-1 size-4" />
                              {t("removeAction")}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length && (
                <div className="p-10 text-center text-muted-foreground">
                  <IconBooks className="mx-auto mb-2 size-8" />
                  {!classCourses && selectedClassId
                    ? t("loadingWeighted")
                    : selectedClass && selectedClass.configuredCount === 0
                      ? t("noWeightedConfigure")
                      : t("noMatching")}
                </div>
              )}
            </div>
          </Card>
        </div>
    </BranchPageShell>
  );
}

function TeacherPicker({
  teachers,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  allowAll,
  allowClear,
}: {
  teachers: Array<{ id: string; name: string; cycles?: Cycle[] }>;
  value: string;
  onChange: (teacherId: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  allowAll?: boolean;
  allowClear?: boolean;
}) {
  const t = useTranslations("teaching.assignments");
  const [open, setOpen] = useState(false);
  const selected = teachers.find((teacher) => teacher.id === value);
  const displayValue =
    allowAll && value === "all"
      ? t("allTeachers")
      : selected?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between font-normal",
            !selected && !(allowAll && value === "all") && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{displayValue ?? placeholder}</span>
          <IconChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("searchTeacher")} />
          <CommandList className="max-h-64">
            <CommandEmpty>{t("noTeacherFound")}</CommandEmpty>
            <CommandGroup heading={t("teachersCount", { count: teachers.length })}>
              {allowAll && (
                <CommandItem
                  value="tous les enseignants"
                  onSelect={() => {
                    onChange("all");
                    setOpen(false);
                  }}
                >
                  <IconCheck
                    className={cn(
                      "mr-2 size-4",
                      value === "all" ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {t("allTeachers")}
                </CommandItem>
              )}
              {allowClear && (
                <CommandItem
                  value="retirer affectation"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <IconX className="mr-2 size-4 text-destructive" />
                  <span className="text-destructive">{t("removeAssignment")}</span>
                </CommandItem>
              )}
              {teachers.map((teacher) => (
                <CommandItem
                  key={teacher.id}
                  value={`${teacher.name} ${teacher.id}`}
                  onSelect={() => {
                    onChange(teacher.id);
                    setOpen(false);
                  }}
                >
                  <IconCheck
                    className={cn(
                      "mr-2 size-4",
                      teacher.id === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{teacher.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
