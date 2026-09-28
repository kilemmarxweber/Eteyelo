"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  IconBook2,
  IconBrandWhatsapp,
  IconCalendarTime,
  IconClockHour4,
  IconPrinter,
  IconSchool,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { MultiSelect } from "../../paiement/components/MultiSelect";
import { useSession } from "@/lib/auth-client";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { DEFAULT_CRENEAU_WORKING_DAYS } from "@/lib/creneau-working-days";
import {
  formatTeachingHoursLabel,
  sumScheduleMinutes,
  teachingHoursFromMinutes,
} from "@/lib/teacher-schedule-load";
import { cn } from "@/lib/utils";
import { getTeacherReportContextAction } from "../teacher.action";
import {
  getGlobalScheduleByCycleAction,
  getGlobalScheduleCyclesAction,
} from "../../schedule/schedule.action";
import { sendGlobalScheduleWhatsAppAction } from "./horaire-global.action";
import {
  exportGlobalSchedulePdf,
  type GlobalSchedulePdfTable,
} from "./export-global-schedule-pdf";
import { exportTeacherHoursListPdf } from "./export-teacher-hours-list-pdf";
import { GlobalScheduleGrid } from "./global-schedule-grid";
import {
  alignSaturdayHours,
  teacherSaturdayRange,
  teacherScheduleClock,
  unionWorkingDays,
} from "./saturday-clock";
import { teacherSchedulePdfTable } from "./teacher-schedule-pdf-table";
import type {
  GlobalScheduleByCycle,
  GlobalScheduleCreneau,
  GlobalScheduleCycleOption,
  GlobalScheduleEntry,
  GlobalScheduleTeacher,
} from "./types";
import type { Cycle } from "@/lib/cycle";

type ViewMode = "teachers" | "grid" | "hours";

function isAssignedTeacher(teacher: GlobalScheduleTeacher) {
  return (
    Boolean(teacher.id) &&
    !teacher.id.startsWith("unassigned:") &&
    teacher.classCount > 0 &&
    teacher.courseCount > 0 &&
    teacher.periodCount > 0
  );
}

function teacherHasContact(teacher: GlobalScheduleTeacher) {
  return isAssignedTeacher(teacher) && Boolean(teacher.telephone?.trim());
}

/** Heures de lignes grille : slots du créneau, sinon heures des séances. */
function gridHoursForCreneau(
  creneau: GlobalScheduleCreneau,
  entries: GlobalScheduleEntry[],
) {
  if (creneau.slots.length > 0) {
    const entryHours = entries
      .filter((entry) => entry.creneauId === creneau.id)
      .map((entry) => entry.hour)
      .filter(Boolean);
    return [...new Set([...creneau.slots, ...entryHours])].sort();
  }
  return [
    ...new Set(
      entries
        .filter((entry) => entry.creneauId === creneau.id)
        .map((entry) => entry.hour)
        .filter(Boolean),
    ),
  ].sort();
}

function teacherLoadFromEntries(
  entries: GlobalScheduleEntry[],
  schedule: GlobalScheduleByCycle,
) {
  const durationByCreneauId = new Map(
    schedule.creneaux.map((creneau) => [
      creneau.id,
      creneau.durationCourse > 0
        ? creneau.durationCourse
        : schedule.hourUnitMinutes,
    ]),
  );
  const classIds = new Set(entries.map((e) => e.classe.id).filter(Boolean));
  const courseIds = new Set(entries.map((e) => e.cours.id).filter(Boolean));
  const totalMinutes = sumScheduleMinutes(
    entries,
    durationByCreneauId,
    schedule.hourUnitMinutes,
  );
  const hoursCount = teachingHoursFromMinutes(
    totalMinutes,
    schedule.hourUnitMinutes,
  );
  return {
    classCount: classIds.size,
    courseCount: courseIds.size,
    periodCount: entries.length,
    totalMinutes,
    hoursCount,
    hoursLabel: formatTeachingHoursLabel(hoursCount),
    creneauIds: [
      ...new Set(
        entries.map((e) => e.creneauId).filter((v): v is string => Boolean(v)),
      ),
    ],
  };
}

function academicGroupsLabel(
  t: ReturnType<typeof useTranslations>,
  kind: GlobalScheduleTeacher["academicGroupKind"],
  count: number,
) {
  switch (kind) {
    case "semester":
      return t("groupsSemesters", { count });
    case "module":
      return t("groupsModules", { count });
    case "session":
      return t("groupsSessions", { count });
    default:
      return t("groupsTrimesters", { count });
  }
}

function formatTeacherMeta(
  t: ReturnType<typeof useTranslations>,
  teacher: GlobalScheduleTeacher,
) {
  return t("teacherMeta", {
    classes: teacher.classCount,
    courses: teacher.courseCount,
    periods: teacher.academicPeriodCount,
    groupsLabel: academicGroupsLabel(
      t,
      teacher.academicGroupKind,
      teacher.academicGroupCount,
    ),
    hours: teacher.hoursLabel,
  });
}

function teacherHoursClock(
  teacher: GlobalScheduleTeacher,
  schedule: GlobalScheduleByCycle,
) {
  const teacherCreneaux =
    teacher.creneauIds.length > 0
      ? schedule.creneaux.filter((creneau) =>
          teacher.creneauIds.includes(creneau.id),
        )
      : schedule.creneaux;
  return teacherScheduleClock({
    teacherCreneaux,
    fallbackHours: teacher.entries.map((entry) => entry.hour),
    allCreneaux: schedule.creneaux,
  });
}

/** Nom + charge : « 1 classe · 10 cours · … · 31H · Samedi : 07:30 – 12:15 » */
function formatTeacherHoursDetails(
  t: ReturnType<typeof useTranslations>,
  teacher: GlobalScheduleTeacher,
  schedule: GlobalScheduleByCycle,
) {
  const meta = formatTeacherMeta(t, teacher);
  const saturday = teacherSaturdayRange(teacherHoursClock(teacher, schedule));
  if (!saturday) return meta;
  return `${meta} · ${t("saturdayLabel", { range: saturday })}`;
}

export function HoraireGlobalClient() {
  const t = useTranslations("users.teachers.globalSchedule");
  const tCommon = useTranslations("common");
  const peopleLabels = useBranchPeopleLabels();
  const params = useParams<{ organizationId: string; branchId: string }>();
  const { data: session, isPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const sessionReady = hasMounted && !isPending;

  const [cycles, setCycles] = useState<GlobalScheduleCycleOption[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | "">("");
  const [schedule, setSchedule] = useState<GlobalScheduleByCycle | null>(null);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("teachers");
  const [query, setQuery] = useState("");
  const [atelierWeekKey, setAtelierWeekKey] = useState<"current" | "next">(
    "current",
  );
  const [printing, setPrinting] = useState(false);
  const [canSendWhatsApp, setCanSendWhatsApp] = useState(false);
  const [whatsappConfirmOpen, setWhatsappConfirmOpen] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingTeacherId, setSendingTeacherId] = useState<string | null>(null);

  const listHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/teacher`;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!sessionReady || !session) return;

    let cancelled = false;
    async function loadCycles() {
      setLoadingCycles(true);
      setError(null);
      const [data, err] = await getGlobalScheduleCyclesAction();
      if (cancelled) return;
      if (err || !data) {
        setCycles([]);
        setCanSendWhatsApp(false);
        setError(t("loadError"));
        setLoadingCycles(false);
        return;
      }
      setCycles(data.cycles);
      setCanSendWhatsApp(Boolean(data.canSendWhatsApp));
      setSelectedCycle((current) => {
        if (current && data.cycles.some((cycle) => cycle.value === current)) {
          return current;
        }
        return data.cycles[0]?.value ?? "";
      });
      setLoadingCycles(false);
    }

    void loadCycles();
    return () => {
      cancelled = true;
    };
  }, [session, sessionReady, t]);

  useEffect(() => {
    if (!sessionReady || !session || !selectedCycle) {
      setSchedule(null);
      if (!selectedCycle && !loadingCycles) {
        setLoadingSchedule(false);
      }
      return;
    }

    let cancelled = false;
    async function loadSchedule() {
      setLoadingSchedule(true);
      setError(null);
      setQuery("");
      const [data, err] = await getGlobalScheduleByCycleAction({
        cycle: selectedCycle as Cycle,
      });
      if (cancelled) return;
      if (err || !data) {
        setSchedule(null);
        setSelectedTeacherIds([]);
        setError(t("loadError"));
        setLoadingSchedule(false);
        return;
      }
      setSchedule(data);
      setAtelierWeekKey("current");
      setSelectedTeacherIds(
        data.teachers.filter(teacherHasContact).map((teacher) => teacher.id),
      );
      setLoadingSchedule(false);
    }

    void loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [loadingCycles, selectedCycle, session, sessionReady, t]);

  const filteredTeachers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const week =
      schedule?.atelierWeeks?.find((w) => w.key === atelierWeekKey) ?? null;

    if (week && schedule) {
      const metaById = new Map(
        schedule.teachers.map((teacher) => [teacher.id, teacher]),
      );
      const grouped = new Map<
        string,
        {
          teacher: (typeof schedule.teachers)[number] | null;
          entryTeacher: (typeof week.entries)[number]["teacher"];
          entries: typeof week.entries;
        }
      >();

      for (const entry of week.entries) {
        const tid = entry.teacher.id || `unassigned:${entry.id}`;
        const existing = grouped.get(tid);
        if (existing) {
          existing.entries.push(entry);
          continue;
        }
        grouped.set(tid, {
          teacher: entry.teacher.id
            ? (metaById.get(entry.teacher.id) ?? null)
            : null,
          entryTeacher: entry.teacher,
          entries: [entry],
        });
      }

      const teachers = [...grouped.entries()]
        .map(([id, row]) => {
          const load = teacherLoadFromEntries(row.entries, schedule);
          const meta = row.teacher;
          const isUnassigned = id.startsWith("unassigned:");
          if (meta) {
            return {
              ...meta,
              ...load,
              telephone: meta.telephone || row.entryTeacher.telephone,
              entries: row.entries,
            };
          }
          return {
            id: isUnassigned ? id : id,
            nom: row.entryTeacher.nom,
            postnom: row.entryTeacher.postnom,
            prenom: row.entryTeacher.prenom,
            name: row.entryTeacher.name || "Non assigné",
            telephone: row.entryTeacher.telephone,
            ...load,
            academicPeriodCount: schedule.academicPeriodCount,
            academicGroupCount: schedule.academicGroupCount,
            academicGroupKind: schedule.academicGroupKind,
            entries: row.entries,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));

      if (!needle) return teachers;
      return teachers.filter((teacher) =>
        teacher.name.toLowerCase().includes(needle),
      );
    }

    const teachers = schedule?.teachers ?? [];
    if (!needle) return teachers;
    return teachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(needle),
    );
  }, [atelierWeekKey, query, schedule]);

  const activeGridWeeks = useMemo(() => {
    if (!schedule) return [];
    if (schedule.atelierWeeks && schedule.atelierWeeks.length > 0) {
      return schedule.atelierWeeks;
    }
    return [
      {
        key: "current" as const,
        label: schedule.cycleLabel,
        rangeLabel: "",
        mondayIso: "",
        entries: schedule.entries,
      },
    ];
  }, [schedule]);

  const hoursListTeachers = useMemo(() => {
    return [...filteredTeachers].sort((a, b) => {
      if (b.hoursCount !== a.hoursCount) return b.hoursCount - a.hoursCount;
      return a.name.localeCompare(b.name, "fr");
    });
  }, [filteredTeachers]);

  const whatsappTargets = useMemo(() => {
    const teachers = schedule?.teachers ?? [];
    return {
      assigned: teachers.filter(isAssignedTeacher),
      withContact: teachers.filter(teacherHasContact),
      withoutContact: teachers.filter(
        (teacher) => isAssignedTeacher(teacher) && !teacher.telephone?.trim(),
      ),
    };
  }, [schedule?.teachers]);

  const selectedWhatsAppTargets = useMemo(() => {
    const selected = new Set(selectedTeacherIds);
    return {
      withContact: whatsappTargets.withContact.filter((teacher) =>
        selected.has(teacher.id),
      ),
      withoutContact: whatsappTargets.withoutContact.filter((teacher) =>
        selected.has(teacher.id),
      ),
    };
  }, [selectedTeacherIds, whatsappTargets]);

  const teacherSelectOptions = useMemo(
    () =>
      whatsappTargets.assigned.map((teacher) => ({
        value: teacher.id,
        label: teacherHasContact(teacher)
          ? teacher.name
          : `${teacher.name} (${t("whatsappNoContact")})`,
        disabled: !teacherHasContact(teacher),
      })),
    [t, whatsappTargets.assigned],
  );

  const canPrint = Boolean(
    schedule &&
      schedule.periodCount > 0 &&
      !loadingSchedule &&
      (view === "grid" ||
        (view === "hours"
          ? hoursListTeachers.length > 0
          : filteredTeachers.length > 0)),
  );

  const canSendAllWhatsApp = Boolean(
    canSendWhatsApp &&
      schedule &&
      schedule.periodCount > 0 &&
      !loadingSchedule &&
      whatsappTargets.withContact.length > 0,
  );

  function toastWhatsAppResult(result: {
    queued?: boolean;
    count?: number;
    sent?: number;
    skippedNoContact: number;
    failed?: number;
    error?: string | null;
  }) {
    if (result.queued && (result.count ?? 0) > 0) {
      toast.success(t("whatsappQueued", { count: result.count ?? 0 }));
      return;
    }
    if ((result.sent ?? 0) > 0 && (result.failed ?? 0) === 0 && result.skippedNoContact === 0) {
      toast.success(t("whatsappSuccess", { sent: result.sent ?? 0 }));
      return;
    }
    if ((result.sent ?? 0) > 0) {
      toast.success(
        t("whatsappPartial", {
          sent: result.sent ?? 0,
          skipped: result.skippedNoContact,
          failed: result.failed ?? 0,
        }),
      );
      if (result.error) toast.error(result.error);
      return;
    }
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.skippedNoContact > 0 && (result.failed ?? 0) === 0) {
      toast.error(t("whatsappNone"));
      return;
    }
    toast.error(t("whatsappFailed"));
  }

  async function sendWhatsApp(teacherIds: string[]) {
    if (!selectedCycle || teacherIds.length === 0) return;
    const [result, err] = await sendGlobalScheduleWhatsAppAction({
      cycle: selectedCycle as Cycle,
      teacherIds,
    });
    if (err || !result) {
      toast.error(err?.message || t("whatsappFailed"));
      return;
    }
    toastWhatsAppResult(result);
  }

  function openWhatsAppDialog() {
    setSelectedTeacherIds(whatsappTargets.withContact.map((teacher) => teacher.id));
    setWhatsappConfirmOpen(true);
  }

  async function handleSendAllWhatsApp() {
    const teacherIds = selectedWhatsAppTargets.withContact.map(
      (teacher) => teacher.id,
    );
    if (teacherIds.length === 0) {
      toast.error(t("whatsappNoSelection"));
      return;
    }
    setSendingAll(true);
    try {
      await sendWhatsApp(teacherIds);
      setWhatsappConfirmOpen(false);
    } finally {
      setSendingAll(false);
    }
  }

  async function handleSendTeacherWhatsApp(teacher: GlobalScheduleTeacher) {
    if (!teacherHasContact(teacher)) {
      toast.error(t("whatsappNoContact"));
      return;
    }
    setSendingTeacherId(teacher.id);
    try {
      await sendWhatsApp([teacher.id]);
    } finally {
      setSendingTeacherId(null);
    }
  }

  async function handlePrint() {
    if (!schedule || schedule.periodCount === 0) return;
    setPrinting(true);
    try {
      const [context, err] = await getTeacherReportContextAction();
      if (err || !context) {
        toast.error(t("printFailed"));
        return;
      }

      if (view === "hours") {
        const rows = hoursListTeachers.map((teacher) => ({
          name: teacher.name,
          details: formatTeacherHoursDetails(t, teacher, schedule),
        }));
        if (!rows.length) {
          toast.error(t("empty"));
          return;
        }
        await exportTeacherHoursListPdf({
          context,
          title: t("printHoursPdfTitle", { cycle: schedule.cycleLabel }),
          details: [t("viewHours")],
          yearLabel: String(t.raw("yearLabel")),
          teacherColumn: t("hoursListTeacher"),
          loadColumn: t("hoursListLoad"),
          rows,
        });
        toast.success(t("printSuccess"));
        return;
      }

      const tables: GlobalSchedulePdfTable[] =
        view === "teachers"
          ? filteredTeachers.map((teacher) =>
              teacherSchedulePdfTable(
                teacher,
                schedule,
                formatTeacherMeta(t, teacher),
              ),
            )
          : activeGridWeeks.flatMap((week) => {
              const weekTitle = schedule.atelierWeeks
                ? `${week.label}${week.rangeLabel ? ` · ${week.rangeLabel}` : ""}`
                : t("cycleTitle", { cycle: schedule.cycleLabel });
              if (schedule.creneaux.length === 0) {
                return [
                  {
                    title: weekTitle,
                    hours: [
                      ...new Set(week.entries.map((entry) => entry.hour)),
                    ].sort(),
                    workingDays: [...DEFAULT_CRENEAU_WORKING_DAYS],
                    entries: week.entries,
                    showTeacher: true,
                  } satisfies GlobalSchedulePdfTable,
                ];
              }
              return [
                ...schedule.creneaux.map((creneau) => {
                  const saturday = alignSaturdayHours(creneau.slots, [creneau]);
                  return {
                    title: schedule.atelierWeeks
                      ? `${weekTitle} — ${t("vacation", { name: creneau.nameCreneau })}`
                      : t("vacation", { name: creneau.nameCreneau }),
                    subtitle: `${creneau.startTime} – ${creneau.endTime} · ${t("vacationClasses", { count: creneau.classeCount })}`,
                    hours: creneau.slots,
                    workingDays: creneau.workingDays,
                    recreationHour: creneau.recreationHour,
                    endTime: creneau.endTime,
                    saturdayHours: saturday.saturdayHours,
                    saturdayEndTime: saturday.saturdayEndTime,
                    entries: week.entries.filter(
                      (entry) => entry.creneauId === creneau.id,
                    ),
                    showTeacher: true,
                  } satisfies GlobalSchedulePdfTable;
                }),
                ...(week.entries.some((entry) => !entry.creneauId)
                  ? [
                      {
                        title: schedule.atelierWeeks
                          ? `${weekTitle} — ${t("noCreneauTitle")}`
                          : t("noCreneauTitle"),
                        hours: [
                          ...new Set(
                            week.entries
                              .filter((entry) => !entry.creneauId)
                              .map((entry) => entry.hour),
                          ),
                        ].sort(),
                        workingDays: unionWorkingDays(schedule.creneaux),
                        entries: week.entries.filter(
                          (entry) => !entry.creneauId,
                        ),
                        showTeacher: true,
                      } satisfies GlobalSchedulePdfTable,
                    ]
                  : []),
              ];
            });

      if (!tables.length) {
        toast.error(t("empty"));
        return;
      }

      await exportGlobalSchedulePdf({
        context,
        title: t("printPdfTitle", { cycle: schedule.cycleLabel }),
        details: [view === "teachers" ? t("viewTeachers") : t("viewGrid")],
        hoursLabel: t("hoursColumn"),
        recreationLabel: t("recreationPdf"),
        yearLabel: String(t.raw("yearLabel")),
        saturdayLabel: String(t.raw("saturdayLabel")),
        tables,
      });
      toast.success(t("printSuccess"));
    } catch (error) {
      console.error(error);
      toast.error(t("printFailed"));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <BranchPageShell
      title={t("title")}
      description={t("description")}
      backHref={listHref}
      backLabel={t("backToTeachers", { teachers: peopleLabels.teacherPlural })}
      badge={
        <Badge variant="outline-primary" icon={<IconCalendarTime size={14} />}>
          {t("badge")}
        </Badge>
      }
    >
      <div className="space-y-4">
        {cycles.length > 0 ? (
          <Tabs
            value={selectedCycle || cycles[0]?.value}
            onValueChange={(value) => setSelectedCycle(value as Cycle)}
          >
            <TabsList
              className={cn(
                "grid h-auto w-full border border-primary/20 bg-primary/10 sm:w-auto",
                cycles.length <= 3
                  ? "grid-cols-1 sm:grid-cols-none sm:inline-flex"
                  : "auto-cols-fr grid-flow-col",
              )}
              style={
                cycles.length > 1
                  ? { gridTemplateColumns: `repeat(${cycles.length}, minmax(0, 1fr))` }
                  : undefined
              }
            >
              {cycles.map((cycle) => (
                <TabsTrigger
                  key={cycle.value}
                  value={cycle.value}
                  className="px-4 py-2 text-sm text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {cycle.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <BranchStatCard
            label={t("statTeachers", { teachers: peopleLabels.teacherPlural })}
            value={schedule?.teacherCount ?? "—"}
            description={schedule?.cycleLabel}
            icon={IconUsers}
          />
          <BranchStatCard
            label={t("statClasses")}
            value={schedule?.classCount ?? "—"}
            description={t("statClassesHint")}
            icon={IconSchool}
          />
          <BranchStatCard
            label={t("statCourses")}
            value={schedule?.courseCount ?? "—"}
            description={t("statCoursesHint")}
            icon={IconBook2}
          />
          <BranchStatCard
            label={t("statSlots")}
            value={schedule?.periodCount ?? "—"}
            description={t("statSlotsHint")}
            icon={IconClockHour4}
          />
          <BranchStatCard
            label={t("statHours")}
            value={schedule?.hoursLabel ?? "—"}
            description={
              schedule
                ? t("statHoursHint", { minutes: schedule.hourUnitMinutes })
                : undefined
            }
            icon={IconClockHour4}
          />
          <BranchStatCard
            label={t("statAcademic")}
            value={
              schedule
                ? t("statAcademicValue", {
                    periods: schedule.academicPeriodCount,
                  })
                : "—"
            }
            description={
              schedule
                ? academicGroupsLabel(
                    t,
                    schedule.academicGroupKind,
                    schedule.academicGroupCount,
                  )
                : undefined
            }
            icon={IconCalendarTime}
          />
        </div>

        <Card variant="elevated" className="border p-1 shadow-sm md:p-4">
          <CardHeader className="gap-4 px-3 pt-3 md:px-0 md:pt-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle>
                {selectedCycle
                  ? t("cycleTitle", { cycle: schedule?.cycleLabel ?? "" })
                  : t("selectCycle")}
              </CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Tabs
                  value={view}
                  onValueChange={(value) => setView(value as ViewMode)}
                >
                  <TabsList className="grid h-auto grid-cols-3 border border-primary/20 bg-primary/10">
                    <TabsTrigger
                      value="teachers"
                      className="px-3 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm"
                    >
                      {t("viewTeachers")}
                    </TabsTrigger>
                    <TabsTrigger
                      value="grid"
                      className="px-3 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm"
                    >
                      {t("viewGrid")}
                    </TabsTrigger>
                    <TabsTrigger
                      value="hours"
                      className="px-3 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm"
                    >
                      {t("viewHours")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {view === "teachers" || view === "hours" ? (
                  <div className="relative min-w-[16rem]">
                    <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t("searchTeacher", {
                        teacher: peopleLabels.teacherLower,
                      })}
                      className="h-9 pl-8"
                    />
                  </div>
                ) : null}
                {canSendWhatsApp ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openWhatsAppDialog()}
                    disabled={!canSendAllWhatsApp || sendingAll || printing}
                    title={
                      canSendAllWhatsApp ? t("whatsappAll") : t("whatsappNone")
                    }
                  >
                    <IconBrandWhatsapp className="size-4" />
                    {sendingAll ? t("whatsappSending") : t("whatsappAll")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handlePrint()}
                  disabled={!canPrint || printing || sendingAll}
                >
                  <IconPrinter className="size-4" />
                  {printing ? t("printing") : t("print")}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 px-3 pb-3 md:px-0 md:pb-0">
            {loadingCycles || loadingSchedule ? (
              <TableSkeleton />
            ) : error ? (
              <EmptyTableState title={error} description={t("retryLater")} />
            ) : cycles.length === 0 ? (
              <EmptyTableState
                title={t("noCycles")}
                description={t("noCyclesHint")}
              />
            ) : !selectedCycle ? (
              <EmptyTableState
                title={t("selectCycle")}
                description={t("selectCycleHint")}
              />
            ) : !schedule ||
              (schedule.periodCount === 0 &&
                !(schedule.atelierWeeks ?? []).some(
                  (week) => week.entries.length > 0,
                )) ? (
              <EmptyTableState
                title={t("empty")}
                description={t("emptyHint")}
              />
            ) : view === "grid" ? (
              <div className="space-y-10">
                {activeGridWeeks.map((week) => (
                  <div key={week.key} className="space-y-8">
                    {schedule.atelierWeeks ? (
                      <div className="border-b border-amber-200/80 pb-2 dark:border-amber-900/50">
                        <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
                          {week.label}
                          {week.rangeLabel ? (
                            <span className="ml-2 font-normal text-muted-foreground">
                              · {week.rangeLabel}
                            </span>
                          ) : null}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          Cours de rotation résolus pour cette semaine
                        </p>
                      </div>
                    ) : null}
                    {schedule.creneaux.length === 0 ? (
                      <GlobalScheduleGrid
                        hours={[
                          ...new Set(week.entries.map((entry) => entry.hour)),
                        ].sort()}
                        entries={week.entries}
                        emptyLabel={t("empty")}
                        hoursLabel={t("hoursColumn")}
                        recreationLabel={(start, end) =>
                          t("recreationRow", { start, end })
                        }
                      />
                    ) : (
                      <>
                        {schedule.creneaux.map((creneau) => {
                          const creneauEntries = week.entries.filter(
                            (entry) => entry.creneauId === creneau.id,
                          );
                          const hours = gridHoursForCreneau(
                            creneau,
                            week.entries,
                          );
                          const saturday = alignSaturdayHours(
                            hours.length > 0 ? hours : creneau.slots,
                            [creneau],
                          );
                          return (
                            <section key={`${week.key}-${creneau.id}`} className="space-y-3">
                              <div>
                                <h3 className="text-base font-semibold">
                                  {t("vacation", { name: creneau.nameCreneau })}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {creneau.startTime} – {creneau.endTime} ·{" "}
                                  {t("vacationClasses", {
                                    count: creneau.classeCount,
                                  })}
                                </p>
                              </div>
                              <GlobalScheduleGrid
                                hours={hours}
                                workingDays={creneau.workingDays}
                                recreationHour={creneau.recreationHour}
                                endTime={creneau.endTime}
                                saturdayHours={saturday.saturdayHours}
                                saturdayEndTime={saturday.saturdayEndTime}
                                entries={creneauEntries}
                                emptyLabel={t("empty")}
                                hoursLabel={t("hoursColumn")}
                                recreationLabel={(start, end) =>
                                  t("recreationRow", { start, end })
                                }
                              />
                            </section>
                          );
                        })}
                        {week.entries.some((entry) => !entry.creneauId) ? (
                          <section className="space-y-3">
                            <h3 className="text-base font-semibold">
                              {t("noCreneauTitle")}
                            </h3>
                            <GlobalScheduleGrid
                              hours={[
                                ...new Set(
                                  week.entries
                                    .filter((entry) => !entry.creneauId)
                                    .map((entry) => entry.hour),
                                ),
                              ].sort()}
                              entries={week.entries.filter(
                                (entry) => !entry.creneauId,
                              )}
                              emptyLabel={t("empty")}
                              hoursLabel={t("hoursColumn")}
                              recreationLabel={(start, end) =>
                                t("recreationRow", { start, end })
                              }
                            />
                          </section>
                        ) : null}
                      </>
                    )}
                  </div>
                ))}
                {schedule.classesWithoutCreneau > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noCreneau", { count: schedule.classesWithoutCreneau })}
                  </p>
                ) : null}
              </div>
            ) : view === "hours" ? (
              hoursListTeachers.length === 0 ? (
                <EmptyTableState
                  title={t("noTeacherMatch")}
                  description={t("noTeacherMatchHint")}
                />
              ) : (
                <ul className="divide-y rounded-lg border">
                  {hoursListTeachers.map((teacher) => (
                    <li
                      key={teacher.id || teacher.name}
                      className="flex flex-col gap-0.5 px-3 py-3 sm:flex-row sm:items-baseline sm:gap-2"
                    >
                      <span className="shrink-0 text-sm font-semibold uppercase tracking-wide">
                        {teacher.name}
                      </span>
                      <span className="hidden text-muted-foreground sm:inline">
                        :
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatTeacherHoursDetails(t, teacher, schedule)}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : filteredTeachers.length === 0 ? (
              <EmptyTableState
                title={t("noTeacherMatch")}
                description={t("noTeacherMatchHint")}
              />
            ) : (
              <div className="space-y-8">
                {schedule.atelierWeeks && schedule.atelierWeeks.length > 0 ? (
                  <div
                    role="tablist"
                    aria-label="Semaine d'affichage"
                    className="grid w-full grid-cols-1 gap-2 min-[480px]:grid-cols-2"
                  >
                    {schedule.atelierWeeks.map((week) => {
                      const active = atelierWeekKey === week.key;
                      return (
                        <button
                          key={week.key}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setAtelierWeekKey(week.key)}
                          className={cn(
                            "flex w-full min-w-0 flex-col items-stretch gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                            active
                              ? "border-amber-500 bg-amber-200 text-amber-950 shadow-sm ring-2 ring-amber-400/60 dark:border-amber-400 dark:bg-amber-800 dark:text-amber-50 dark:ring-amber-500/50"
                              : "border-amber-200/80 bg-amber-50/50 text-amber-950/80 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100/80 dark:hover:bg-amber-950/40",
                          )}
                        >
                          <span className="truncate text-sm font-semibold leading-tight">
                            {week.label}
                          </span>
                          {week.rangeLabel ? (
                            <span className="truncate text-[11px] font-normal text-muted-foreground sm:text-xs">
                              {week.rangeLabel}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {filteredTeachers.map((teacher) => {
                  const clock = teacherHoursClock(teacher, schedule);

                  return (
                    <section key={teacher.id || teacher.name} className="space-y-3">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold uppercase">
                            {teacher.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {formatTeacherMeta(t, teacher)}
                            {teacher.telephone?.trim()
                              ? ` · ${teacher.telephone.trim()}`
                              : ` · ${t("whatsappNoContact")}`}
                          </p>
                        </div>
                        {canSendWhatsApp ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleSendTeacherWhatsApp(teacher)}
                            disabled={
                              !teacherHasContact(teacher) ||
                              sendingAll ||
                              sendingTeacherId === teacher.id
                            }
                            title={t("whatsappOneTitle", { name: teacher.name })}
                          >
                            <IconBrandWhatsapp className="size-4" />
                            {sendingTeacherId === teacher.id
                              ? t("whatsappSending")
                              : t("whatsapp")}
                          </Button>
                        ) : null}
                      </div>
                      <GlobalScheduleGrid
                        hours={clock.hours}
                        workingDays={clock.workingDays}
                        recreationHour={clock.recreationHour}
                        endTime={clock.endTime}
                        saturdayHours={clock.saturdayHours}
                        saturdayEndTime={clock.saturdayEndTime}
                        entries={teacher.entries}
                        showTeacher={false}
                        emptyLabel={t("empty")}
                        hoursLabel={t("hoursColumn")}
                        recreationLabel={(start, end) =>
                          t("recreationRow", { start, end })
                        }
                      />
                    </section>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={whatsappConfirmOpen}
        onOpenChange={setWhatsappConfirmOpen}
      >
        <DialogContent
          title={t("whatsappConfirmTitle")}
          size="sm"
          className="w-[min(calc(100vw-2rem),36rem)] overflow-visible bg-background"
        >
          <DialogHeader>
            <DialogDescription>
              {t("whatsappConfirmDescription", {
                count: selectedWhatsAppTargets.withContact.length,
                cycle: schedule?.cycleLabel ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t("whatsappSelectTeachers")}</p>
              <MultiSelect
                options={teacherSelectOptions}
                value={selectedTeacherIds}
                onValueChange={setSelectedTeacherIds}
                placeholder={t("whatsappSelectPlaceholder")}
                selectedCountLabel={(count) =>
                  t("whatsappSelectCount", { count })
                }
                maxCount={2}
                showSelectAll
                disabled={sendingAll}
                modal={false}
                className="w-full"
              />
            </div>
            {selectedWhatsAppTargets.withoutContact.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("whatsappConfirmSkipped", {
                  count: selectedWhatsAppTargets.withoutContact.length,
                })}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={sendingAll}
              onClick={() => setWhatsappConfirmOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                sendingAll || selectedWhatsAppTargets.withContact.length === 0
              }
              onClick={() => void handleSendAllWhatsApp()}
            >
              {sendingAll ? t("whatsappSending") : t("whatsappConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BranchPageShell>
  );
}
