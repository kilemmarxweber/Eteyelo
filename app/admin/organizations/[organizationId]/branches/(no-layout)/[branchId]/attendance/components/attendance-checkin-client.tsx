"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconCamera,
  IconSearch,
  IconUserCheck,
  IconUsers,
  IconSchool,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  checkInByScanAction,
  checkInPersonByIdAction,
  findOpenCheckoutForPersonAction,
  getQuickCheckInBootstrapAction,
  listPersonnelForCheckInAction,
  listStudentsForClassCheckInAction,
  searchPeopleForCheckInAction,
} from "../attendance-scan.action";
import type {
  AttendanceCheckInCycleGroup,
  AttendanceCheckInResult,
  AttendancePersonLookup,
  AttendancePersonType,
} from "../attendance-scan-types";
import { getCurrentPosition } from "../component/attendance.client";
import { AttendanceCheckoutDialog } from "./attendance-checkout-dialog";
import { AttendanceQuickPersonRow } from "./attendance-quick-person-row";
import { AttendanceScanDialog } from "./attendance-scanner";

async function resolveCheckInCoords() {
  const position = await getCurrentPosition();
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

type RecentCheckIn = AttendanceCheckInResult & { id: string };
type PointageTab = AttendancePersonType;

type CheckoutTarget = {
  personType: AttendancePersonType;
  personId: string;
  attendanceId: string;
  personName: string;
  sessionLabel?: string | null;
};

function looksLikeScanCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{")) return true;
  if (/^(ENS|ELV|PRS)-/i.test(trimmed)) return true;
  return /^[A-Z0-9-]{4,}$/i.test(trimmed) && !trimmed.includes(" ");
}

function personKey(person: Pick<AttendancePersonLookup, "id" | "personType">) {
  return `${person.personType}-${person.id}`;
}

export function AttendanceCheckInClient() {
  const t = useTranslations("attendance");
  const personTypeLabels = useMemo(
    () => ({
      student: t("personType.student"),
      teacher: t("personType.teacher"),
      personnel: t("personType.personnel"),
    }),
    [t],
  );

  const [tab, setTab] = useState<PointageTab>("teacher");
  const [scanOpen, setScanOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AttendancePersonLookup[]>(
    [],
  );
  const [teachers, setTeachers] = useState<AttendancePersonLookup[]>([]);
  const [cycles, setCycles] = useState<AttendanceCheckInCycleGroup[]>([]);
  const [canViewPersonnel, setCanViewPersonnel] = useState(true);
  const [students, setStudents] = useState<AttendancePersonLookup[]>([]);
  const [personnel, setPersonnel] = useState<AttendancePersonLookup[]>([]);
  const [cycleKey, setCycleKey] = useState<string>("");
  const [levelKey, setLevelKey] = useState<string>("");
  const [classeId, setClasseId] = useState<string>("");
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [personnelLoaded, setPersonnelLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentCheckIn[]>([]);
  const [checkout, setCheckout] = useState<CheckoutTarget | null>(null);
  const [pending, startTransition] = useTransition();
  const lastScanRef = useRef<string>("");
  const lastScanAtRef = useRef(0);

  const searching = searchQuery.trim().length >= 2;

  const loadBootstrap = useCallback(async () => {
    const data = await getQuickCheckInBootstrapAction();
    setTeachers(data.teachers);
    setCycles(data.cycles);
    setCanViewPersonnel(data.canViewPersonnel);
    return data;
  }, []);

  const fetchSearchResults = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    const items = await searchPeopleForCheckInAction(trimmed);
    setSearchResults(items);
  }, []);

  const loadStudents = useCallback(async (nextClasseId: string) => {
    if (!nextClasseId) {
      setStudents([]);
      return;
    }
    setStudentsLoading(true);
    try {
      const items = await listStudentsForClassCheckInAction(nextClasseId);
      setStudents(items);
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const loadPersonnel = useCallback(async () => {
    const items = await listPersonnelForCheckInAction();
    setPersonnel(items);
    setPersonnelLoaded(true);
  }, []);

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await loadBootstrap();
        const firstCycle = data.cycles[0];
        const firstLevel = firstCycle?.levels[0];
        const firstClass =
          firstLevel?.classes.find((item) => item.hasUpcomingSession) ??
          firstLevel?.classes[0];
        if (firstCycle) setCycleKey(firstCycle.key);
        if (firstLevel) setLevelKey(firstLevel.key);
        if (firstClass) setClasseId(firstClass.id);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("checkInUi.searchFailed"),
        );
      } finally {
        setBootstrapLoading(false);
      }
    });
  }, [loadBootstrap, t]);

  useEffect(() => {
    if (!searching) {
      setSearchResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        try {
          await fetchSearchResults(searchQuery);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : t("checkInUi.searchFailed"),
          );
        }
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [fetchSearchResults, searchQuery, searching, t]);

  useEffect(() => {
    if (tab !== "student" || !classeId || searching) return;
    startTransition(async () => {
      try {
        await loadStudents(classeId);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("checkInUi.searchFailed"),
        );
      }
    });
  }, [classeId, loadStudents, searching, t, tab]);

  useEffect(() => {
    if (tab !== "personnel" || personnelLoaded || searching) return;
    startTransition(async () => {
      try {
        await loadPersonnel();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("checkInUi.searchFailed"),
        );
      }
    });
  }, [loadPersonnel, personnelLoaded, searching, t, tab]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadBootstrap().catch(() => undefined);
      if (tab === "student" && classeId && !searching) {
        void loadStudents(classeId).catch(() => undefined);
      }
      if (tab === "personnel" && personnelLoaded && !searching) {
        void loadPersonnel().catch(() => undefined);
      }
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [classeId, loadBootstrap, loadPersonnel, loadStudents, personnelLoaded, searching, tab]);

  const selectedCycle = cycles.find((item) => item.key === cycleKey) ?? cycles[0];
  const selectedLevel =
    selectedCycle?.levels.find((item) => item.key === levelKey) ??
    selectedCycle?.levels[0];
  const selectedClass =
    selectedLevel?.classes.find((item) => item.id === classeId) ??
    selectedLevel?.classes[0];

  useEffect(() => {
    if (!selectedCycle) return;
    if (selectedCycle.key !== cycleKey) setCycleKey(selectedCycle.key);
  }, [cycleKey, selectedCycle]);

  useEffect(() => {
    if (!selectedLevel) return;
    if (selectedLevel.key !== levelKey) setLevelKey(selectedLevel.key);
  }, [levelKey, selectedLevel]);

  useEffect(() => {
    if (!selectedClass) return;
    if (selectedClass.id !== classeId) setClasseId(selectedClass.id);
  }, [classeId, selectedClass]);

  const pushRecent = useCallback((result: AttendanceCheckInResult) => {
    setRecent((items) =>
      [
        {
          ...result,
          id: `${Date.now()}-${result.person?.id ?? "unknown"}`,
        },
        ...items,
      ].slice(0, 6),
    );
  }, []);

  const markPersonState = useCallback(
    (
      person: Pick<AttendancePersonLookup, "id" | "personType">,
      patch: Partial<AttendancePersonLookup>,
    ) => {
      const update = (items: AttendancePersonLookup[]) =>
        items.map((item) =>
          item.id === person.id && item.personType === person.personType
            ? { ...item, ...patch }
            : item,
        );
      setTeachers(update);
      setStudents(update);
      setPersonnel(update);
      setSearchResults(update);
    },
    [],
  );

  const openCheckoutFromResult = useCallback(
    (result: AttendanceCheckInResult) => {
      if (
        !result.needsCheckout ||
        !result.attendanceId ||
        !result.personType ||
        !result.person
      ) {
        return;
      }
      setCheckout({
        personType: result.personType,
        personId: result.person.id,
        attendanceId: result.attendanceId,
        personName: result.person.name,
        sessionLabel: result.sessionLabel,
      });
      setScanOpen(false);
      toast.message(result.message);
    },
    [],
  );

  const handleCheckInResult = useCallback(
    (result: AttendanceCheckInResult) => {
      if (result.needsCheckout) {
        openCheckoutFromResult(result);
        return;
      }

      pushRecent(result);
      if (result.ok) {
        toast.success(result.message);
        if (result.person) {
          markPersonState(result.person, {
            alreadyCheckedIn: true,
            canCheckOut: true,
            attendanceId: result.attendanceId ?? null,
            expectedSessionLabel:
              result.sessionLabel ?? result.person.expectedSessionLabel,
          });
        }
        setScanOpen(false);
      } else {
        toast.error(result.message);
        if (result.person && result.statusLabel) {
          markPersonState(result.person, {
            alreadyCheckedIn: true,
            canCheckOut: false,
          });
        }
      }
    },
    [markPersonState, openCheckoutFromResult, pushRecent],
  );

  const runScan = useCallback(
    (code: string) => {
      const value = code.trim();
      if (!value || pending) return;

      const now = Date.now();
      if (lastScanRef.current === value && now - lastScanAtRef.current < 2500) {
        return;
      }

      lastScanRef.current = value;
      lastScanAtRef.current = now;

      startTransition(async () => {
        try {
          const coords = await resolveCheckInCoords();
          const result = await checkInByScanAction(value, coords);
          if (!result) {
            toast.error(t("checkInUi.noInfoFound"));
            return;
          }
          handleCheckInResult(result);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("checkInUi.checkInFailed"),
          );
        }
      });
    },
    [handleCheckInResult, pending, t],
  );

  function checkInPerson(person: AttendancePersonLookup) {
    const key = personKey(person);
    setBusyKey(key);
    startTransition(async () => {
      try {
        const coords = await resolveCheckInCoords();
        const result = await checkInPersonByIdAction(
          person.personType,
          person.id,
          coords,
        );
        handleCheckInResult(result);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("checkInUi.checkInFailed"),
        );
      } finally {
        setBusyKey(null);
      }
    });
  }

  function checkOutPerson(person: AttendancePersonLookup) {
    const key = personKey(person);
    setBusyKey(key);
    startTransition(async () => {
      try {
        const result = await findOpenCheckoutForPersonAction(
          person.personType,
          person.id,
        );
        if (!result) {
          toast.error(t("checkInUi.noOpenPresence"));
          return;
        }
        handleCheckInResult(result);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("checkInUi.checkoutPrepareFailed"),
        );
      } finally {
        setBusyKey(null);
      }
    });
  }

  function renderPersonList(people: AttendancePersonLookup[], emptyLabel: string) {
    if (people.length === 0) {
      return (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      );
    }

    return (
      <div className="max-h-[min(62vh,36rem)] space-y-2 overflow-y-auto pr-1">
        {people.map((person) => (
          <AttendanceQuickPersonRow
            key={personKey(person)}
            person={person}
            pointerLabel={t("checkIn")}
            checkoutLabel={t("checkInUi.checkOutDeparture")}
            doneLabel={t("checkInUi.checkedIn")}
            sessionLabel={
              person.expectedSessionLabel
                ? t("checkInUi.expectedSession", {
                    session: person.expectedSessionLabel,
                  })
                : null
            }
            busy={pending && busyKey === personKey(person)}
            onPointer={() => checkInPerson(person)}
            onCheckout={() => checkOutPerson(person)}
          />
        ))}
      </div>
    );
  }

  const visibleTabs = canViewPersonnel
    ? (["teacher", "student", "personnel"] as const)
    : (["teacher", "student"] as const);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("checkInUi.title")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("checkInUi.description")}
          </p>
        </div>
        <Button
          type="button"
          className="w-full shrink-0 sm:w-auto"
          onClick={() => setScanOpen(true)}
        >
          <IconCamera className="mr-2 size-4" />
          {t("checkInUi.scanCard")}
        </Button>
      </div>

      <div className="sticky top-0 z-10 space-y-3 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9"
            placeholder={t("checkInUi.searchPlaceholder")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && looksLikeScanCode(searchQuery)) {
                event.preventDefault();
                runScan(searchQuery);
              }
            }}
          />
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as PointageTab)}
        >
          <TabsList
            className={cn(
              "grid h-auto min-h-11 w-full border border-primary/20 bg-primary/10",
              visibleTabs.length === 3 ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            <TabsTrigger
              value="teacher"
              className="gap-1.5 py-2.5 text-sm text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <IconUserCheck size={16} className="shrink-0" />
              {t("checkInUi.tabTeachers")}
            </TabsTrigger>
            <TabsTrigger
              value="student"
              className="gap-1.5 py-2.5 text-sm text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <IconSchool size={16} className="shrink-0" />
              {t("checkInUi.tabStudents")}
            </TabsTrigger>
            {canViewPersonnel ? (
              <TabsTrigger
                value="personnel"
                className="gap-1.5 py-2.5 text-sm text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <IconUsers size={16} className="shrink-0" />
                {t("checkInUi.tabPersonnel")}
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>
      </div>

      {searching ? (
        renderPersonList(
          searchResults,
          pending ? t("checkInUi.searching") : t("checkInUi.noPersonFound"),
        )
      ) : (
        <>
          {tab === "teacher" ? (
            bootstrapLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              renderPersonList(teachers, t("checkInUi.noUpcomingTeachers"))
            )
          ) : null}

          {tab === "student" ? (
            bootstrapLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-2/3 rounded-lg" />
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (
            <div className="space-y-3">
              {cycles.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {cycles.map((cycle) => (
                    <Button
                      key={cycle.key}
                      type="button"
                      size="sm"
                      variant={cycle.key === selectedCycle?.key ? "default" : "outline"}
                      onClick={() => {
                        setCycleKey(cycle.key);
                        const nextLevel = cycle.levels[0];
                        setLevelKey(nextLevel?.key ?? "");
                        const nextClass =
                          nextLevel?.classes.find((item) => item.hasUpcomingSession) ??
                          nextLevel?.classes[0];
                        setClasseId(nextClass?.id ?? "");
                      }}
                    >
                      {cycle.label}
                    </Button>
                  ))}
                </div>
              ) : null}

              {selectedCycle?.levels.length ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedCycle.levels.map((level) => (
                    <Button
                      key={level.key}
                      type="button"
                      size="sm"
                      variant={level.key === selectedLevel?.key ? "default" : "outline"}
                      onClick={() => {
                        setLevelKey(level.key);
                        const nextClass =
                          level.classes.find((item) => item.hasUpcomingSession) ??
                          level.classes[0];
                        setClasseId(nextClass?.id ?? "");
                      }}
                    >
                      {level.label}
                    </Button>
                  ))}
                </div>
              ) : null}

              {selectedLevel?.classes.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedLevel.classes.map((classe) => (
                    <button
                      key={classe.id}
                      type="button"
                      onClick={() => setClasseId(classe.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-left text-sm transition",
                        classe.id === selectedClass?.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <span className="font-medium">{classe.name}</span>
                      <span
                        className={cn(
                          "ml-1.5 text-xs",
                          classe.id === selectedClass?.id
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground",
                        )}
                      >
                        {t("checkInUi.studentsCount", { count: classe.studentCount })}
                      </span>
                      {classe.hasUpcomingSession ? (
                        <span
                          className={cn(
                            "ml-1.5 inline-block size-1.5 rounded-full",
                            classe.id === selectedClass?.id
                              ? "bg-primary-foreground"
                              : "bg-primary",
                          )}
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("checkInUi.noClasses")}
                </p>
              )}

              {selectedClass ? (
                studentsLoading || (pending && students.length === 0) ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <Skeleton key={item} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                  renderPersonList(students, t("checkInUi.noStudents"))
                )
              ) : null}
            </div>
            )
          ) : null}

          {tab === "personnel" && canViewPersonnel ? (
            !personnelLoaded && pending ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              renderPersonList(personnel, t("checkInUi.noPersonnel"))
            )
          ) : null}
        </>
      )}

      {recent.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("checkInUi.recentTitle")}</CardTitle>
            <CardDescription>{t("checkInUi.recentDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 px-4 py-3 text-sm"
              >
                <span className="font-medium">
                  {item.person?.name ?? t("checkInUi.personFallback")}
                </span>
                {item.sessionLabel ? (
                  <span className="text-primary">{item.sessionLabel}</span>
                ) : null}
                <span className="text-muted-foreground">
                  {item.person?.matricule}
                </span>
                {item.personType ? (
                  <Badge variant="outline">
                    {personTypeLabels[item.personType]}
                  </Badge>
                ) : null}
                {item.statusLabel ? (
                  <Badge
                    variant={item.status === "LATE" ? "warning" : "success"}
                  >
                    {item.statusLabel}
                  </Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {item.message}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <AttendanceScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={runScan}
        disabled={pending}
      />

      {checkout ? (
        <AttendanceCheckoutDialog
          open={Boolean(checkout)}
          onOpenChange={(open) => {
            if (!open) setCheckout(null);
          }}
          personType={checkout.personType}
          attendanceId={checkout.attendanceId}
          personName={checkout.personName}
          sessionLabel={checkout.sessionLabel}
          onDone={(message) => {
            pushRecent({
              ok: true,
              message,
              personType: checkout.personType,
              person: {
                id: checkout.personId,
                name: checkout.personName,
                matricule: "",
                roleLabel: personTypeLabels[checkout.personType],
                personType: checkout.personType,
              },
              statusLabel: t("status.checkout"),
              sessionLabel: checkout.sessionLabel ?? undefined,
            });
            markPersonState(
              {
                id: checkout.personId,
                personType: checkout.personType,
              },
              { alreadyCheckedIn: true, canCheckOut: false, attendanceId: null },
            );
            setCheckout(null);
          }}
        />
      ) : null}
    </div>
  );
}
