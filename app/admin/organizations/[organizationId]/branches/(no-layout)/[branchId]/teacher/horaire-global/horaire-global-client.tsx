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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { MultiSelect } from "../../paiement/components/MultiSelect";
import { useSession } from "@/lib/auth-client";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { DEFAULT_CRENEAU_WORKING_DAYS } from "@/lib/creneau-working-days";
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
import { GlobalScheduleGrid } from "./global-schedule-grid";
import {
  alignSaturdayHours,
  teacherScheduleClock,
  unionWorkingDays,
} from "./saturday-clock";
import { teacherSchedulePdfTable } from "./teacher-schedule-pdf-table";
import type {
  GlobalScheduleByCycle,
  GlobalScheduleCycleOption,
  GlobalScheduleTeacher,
} from "./types";
import type { Cycle } from "@/lib/cycle";

type ViewMode = "teachers" | "grid";

function isAssignedTeacher(teacher: GlobalScheduleTeacher) {
  return Boolean(teacher.id) && !teacher.id.startsWith("unassigned:");
}

function teacherHasContact(teacher: GlobalScheduleTeacher) {
  return isAssignedTeacher(teacher) && Boolean(teacher.telephone?.trim());
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
    const teachers = schedule?.teachers ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return teachers;
    return teachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(needle),
    );
  }, [query, schedule?.teachers]);

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
      (view !== "teachers" || filteredTeachers.length > 0),
  );

  const canSendAllWhatsApp = Boolean(
    canSendWhatsApp &&
      schedule &&
      schedule.periodCount > 0 &&
      !loadingSchedule &&
      whatsappTargets.withContact.length > 0,
  );

  function toastWhatsAppResult(result: {
    sent: number;
    skippedNoContact: number;
    failed: number;
    error?: string | null;
  }) {
    if (result.sent > 0 && result.failed === 0 && result.skippedNoContact === 0) {
      toast.success(t("whatsappSuccess", { sent: result.sent }));
      return;
    }
    if (result.sent > 0) {
      toast.success(
        t("whatsappPartial", {
          sent: result.sent,
          skipped: result.skippedNoContact,
          failed: result.failed,
        }),
      );
      if (result.error) toast.error(result.error);
      return;
    }
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.skippedNoContact > 0 && result.failed === 0) {
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

      const tables: GlobalSchedulePdfTable[] =
        view === "teachers"
          ? filteredTeachers.map((teacher) =>
              teacherSchedulePdfTable(
                teacher,
                schedule,
                t("teacherMeta", {
                  classes: teacher.classCount,
                  courses: teacher.courseCount,
                  periods: teacher.periodCount,
                }),
              ),
            )
          : schedule.creneaux.length === 0
            ? [
                {
                  title: t("cycleTitle", { cycle: schedule.cycleLabel }),
                  hours: [
                    ...new Set(schedule.entries.map((entry) => entry.hour)),
                  ].sort(),
                  workingDays: [...DEFAULT_CRENEAU_WORKING_DAYS],
                  entries: schedule.entries,
                  showTeacher: true,
                },
              ]
            : [
                ...schedule.creneaux.map((creneau) => {
                  const saturday = alignSaturdayHours(creneau.slots, [creneau]);
                  return {
                    title: t("vacation", { name: creneau.nameCreneau }),
                    subtitle: `${creneau.startTime} – ${creneau.endTime} · ${t("vacationClasses", { count: creneau.classeCount })}`,
                    hours: creneau.slots,
                    workingDays: creneau.workingDays,
                    recreationHour: creneau.recreationHour,
                    endTime: creneau.endTime,
                    saturdayHours: saturday.saturdayHours,
                    saturdayEndTime: saturday.saturdayEndTime,
                    entries: schedule.entries.filter(
                      (entry) => entry.creneauId === creneau.id,
                    ),
                    showTeacher: true,
                  };
                }),
                ...(schedule.entries.some((entry) => !entry.creneauId)
                  ? [
                      {
                        title: t("noCreneauTitle"),
                        hours: [
                          ...new Set(
                            schedule.entries
                              .filter((entry) => !entry.creneauId)
                              .map((entry) => entry.hour),
                          ),
                        ].sort(),
                        workingDays: unionWorkingDays(schedule.creneaux),
                        entries: schedule.entries.filter(
                          (entry) => !entry.creneauId,
                        ),
                        showTeacher: true,
                      } satisfies GlobalSchedulePdfTable,
                    ]
                  : []),
              ];

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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                  <TabsList className="grid h-auto grid-cols-2 border border-primary/20 bg-primary/10">
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
                  </TabsList>
                </Tabs>
                {view === "teachers" ? (
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
            ) : !schedule || schedule.periodCount === 0 ? (
              <EmptyTableState
                title={t("empty")}
                description={t("emptyHint")}
              />
            ) : view === "grid" ? (
              <div className="space-y-8">
                {schedule.creneaux.length === 0 ? (
                  <GlobalScheduleGrid
                    hours={[
                      ...new Set(schedule.entries.map((entry) => entry.hour)),
                    ].sort()}
                    entries={schedule.entries}
                    emptyLabel={t("empty")}
                    hoursLabel={t("hoursColumn")}
                    recreationLabel={(start, end) =>
                      t("recreationRow", { start, end })
                    }
                  />
                ) : (
                  <>
                    {schedule.creneaux.map((creneau) => {
                      const saturday = alignSaturdayHours(creneau.slots, [
                        creneau,
                      ]);
                      return (
                    <section key={creneau.id} className="space-y-3">
                      <div>
                        <h3 className="text-base font-semibold">
                          {t("vacation", { name: creneau.nameCreneau })}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {creneau.startTime} – {creneau.endTime} ·{" "}
                          {t("vacationClasses", { count: creneau.classeCount })}
                        </p>
                      </div>
                      <GlobalScheduleGrid
                        hours={creneau.slots}
                        workingDays={creneau.workingDays}
                        recreationHour={creneau.recreationHour}
                        endTime={creneau.endTime}
                        saturdayHours={saturday.saturdayHours}
                        saturdayEndTime={saturday.saturdayEndTime}
                        entries={schedule.entries.filter(
                          (entry) => entry.creneauId === creneau.id,
                        )}
                        emptyLabel={t("empty")}
                        hoursLabel={t("hoursColumn")}
                        recreationLabel={(start, end) =>
                          t("recreationRow", { start, end })
                        }
                      />
                    </section>
                      );
                    })}
                    {schedule.entries.some((entry) => !entry.creneauId) ? (
                      <section className="space-y-3">
                        <h3 className="text-base font-semibold">
                          {t("noCreneauTitle")}
                        </h3>
                        <GlobalScheduleGrid
                          hours={[
                            ...new Set(
                              schedule.entries
                                .filter((entry) => !entry.creneauId)
                                .map((entry) => entry.hour),
                            ),
                          ].sort()}
                          entries={schedule.entries.filter(
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
                {schedule.classesWithoutCreneau > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noCreneau", { count: schedule.classesWithoutCreneau })}
                  </p>
                ) : null}
              </div>
            ) : filteredTeachers.length === 0 ? (
              <EmptyTableState
                title={t("noTeacherMatch")}
                description={t("noTeacherMatchHint")}
              />
            ) : (
              <div className="space-y-8">
                {filteredTeachers.map((teacher) => {
                  const teacherCreneaux =
                    teacher.creneauIds.length > 0
                      ? schedule.creneaux.filter((creneau) =>
                          teacher.creneauIds.includes(creneau.id),
                        )
                      : schedule.creneaux;
                  const clock = teacherScheduleClock({
                    teacherCreneaux,
                    fallbackHours: teacher.entries.map((entry) => entry.hour),
                    allCreneaux: schedule.creneaux,
                  });

                  return (
                    <section key={teacher.id || teacher.name} className="space-y-3">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold uppercase">
                            {teacher.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t("teacherMeta", {
                              classes: teacher.classCount,
                              courses: teacher.courseCount,
                              periods: teacher.periodCount,
                            })}
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
      <AlertDialog
        open={whatsappConfirmOpen}
        onOpenChange={(open) => {
          if (!sendingAll) setWhatsappConfirmOpen(open);
        }}
      >
        <AlertDialogContent className="w-[min(calc(100vw-2rem),36rem)] bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("whatsappConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("whatsappConfirmDescription", {
                count: selectedWhatsAppTargets.withContact.length,
                cycle: schedule?.cycleLabel ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingAll}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                sendingAll || selectedWhatsAppTargets.withContact.length === 0
              }
              onClick={() => void handleSendAllWhatsApp()}
            >
              {sendingAll ? t("whatsappSending") : t("whatsappConfirmAction")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BranchPageShell>
  );
}
