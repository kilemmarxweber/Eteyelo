"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  IconBook2,
  IconCalendarTime,
  IconClockHour4,
  IconSchool,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { NotFoundView } from "@/components/not-found-view";
import { Badge } from "@/components/ui/badge";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/custom";
import { EmptyTableState } from "@/components/custom";
import { useSession } from "@/lib/auth-client";
import { canAccessPedagogyArea } from "@/lib/auth/session-roles";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { DEFAULT_CRENEAU_WORKING_DAYS } from "@/lib/creneau-working-days";
import { cn } from "@/lib/utils";
import {
  getGlobalScheduleByCycleAction,
  getGlobalScheduleCyclesAction,
} from "../../schedule/schedule.action";
import { GlobalScheduleGrid } from "./global-schedule-grid";
import type {
  GlobalScheduleByCycle,
  GlobalScheduleCreneau,
  GlobalScheduleCycleOption,
} from "./types";
import type { Cycle } from "@/lib/cycle";

type ViewMode = "teachers" | "grid";

function unionWorkingDays(creneaux: GlobalScheduleCreneau[]) {
  const days = new Set(creneaux.flatMap((creneau) => creneau.workingDays));
  if (days.size === 0) return [...DEFAULT_CRENEAU_WORKING_DAYS];
  return DEFAULT_CRENEAU_WORKING_DAYS.filter((day) => days.has(day));
}

export function HoraireGlobalClient() {
  const t = useTranslations("users.teachers.globalSchedule");
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
        setError(t("loadError"));
        setLoadingCycles(false);
        return;
      }
      setCycles(data.cycles);
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
        setError(t("loadError"));
        setLoadingSchedule(false);
        return;
      }
      setSchedule(data);
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

  if (sessionReady && (!session || !canAccessPedagogyArea(session))) {
    return <NotFoundView />;
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
                    {schedule.creneaux.map((creneau) => (
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
                    ))}
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
                  const hours =
                    teacherCreneaux.length > 0
                      ? [
                          ...new Set(
                            teacherCreneaux.flatMap((creneau) => creneau.slots),
                          ),
                        ].sort()
                      : [
                          ...new Set(teacher.entries.map((entry) => entry.hour)),
                        ].sort();
                  const workingDays = unionWorkingDays(
                    teacherCreneaux.length > 0
                      ? teacherCreneaux
                      : schedule.creneaux,
                  );
                  const recreationHour =
                    teacherCreneaux.length === 1
                      ? teacherCreneaux[0]?.recreationHour
                      : "";
                  const endTime =
                    teacherCreneaux.length === 1
                      ? teacherCreneaux[0]?.endTime
                      : teacherCreneaux
                          .map((creneau) => creneau.endTime)
                          .sort()
                          .at(-1) ?? "";

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
                          </p>
                        </div>
                      </div>
                      <GlobalScheduleGrid
                        hours={hours}
                        workingDays={workingDays}
                        recreationHour={recreationHour}
                        endTime={endTime}
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
    </BranchPageShell>
  );
}
