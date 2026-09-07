"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  IconCamera,
  IconFaceId,
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
import { getCurrentGeoCoords } from "../component/attendance.client";
import { AttendanceCheckoutDialog } from "./attendance-checkout-dialog";
import { AttendanceQuickPersonRow } from "./attendance-quick-person-row";
import { AttendanceScanDialog } from "./attendance-scanner";

async function resolveCheckInCoords() {
  return getCurrentGeoCoords();
}

type RecentCheckIn = AttendanceCheckInResult & { id: string };
type PointageTab = AttendancePersonType;

type CheckoutTarget = {
  personType: AttendancePersonType;
  personId: string;
  attendanceId: string;
  personName: string;
  sessionLabel?: string | null;
  requireEarlyExit?: boolean;
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

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time className="font-mono text-lg font-semibold tabular-nums tracking-tight text-foreground sm:text-xl">
      {now
        ? now.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : "--:--:--"}
    </time>
  );
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
  const [scanMode, setScanMode] = useState<"card" | "face">("card");
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
        requireEarlyExit: result.normalCheckoutAllowed === false,
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

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      pushRecent(result);
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
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      );
    }

    return (
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
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
      </div>
    );
  }

  function renderListSkeleton(count: number) {
    return (
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
        {Array.from({ length: count }, (_, index) => (
          <Skeleton key={index} className="h-[4.5rem] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const visibleTabs = canViewPersonnel
    ? (["teacher", "student", "personnel"] as const)
    : (["teacher", "student"] as const);

  const visiblePeople = searching
    ? searchResults
    : tab === "teacher"
      ? teachers
      : tab === "student"
        ? students
        : personnel;
  const checkedCount = visiblePeople.filter((person) => person.alreadyCheckedIn)
    .length;
  const pendingCount = Math.max(0, visiblePeople.length - checkedCount);

  function renderRecentItem(item: RecentCheckIn) {
    return (
      <div
        key={item.id}
        className="rounded-lg border bg-background/80 px-3 py-2.5"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium">
            {item.person?.name ?? t("checkInUi.personFallback")}
          </p>
          {item.statusLabel ? (
            <Badge
              variant={item.status === "LATE" ? "warning" : "success"}
              className="shrink-0"
            >
              {item.statusLabel}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {[item.person?.matricule, item.sessionLabel]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    );
  }

  const studentFilters =
    tab === "student" && !searching && !bootstrapLoading ? (
      <div className="shrink-0 space-y-2">
        {cycles.length > 1 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
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
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {selectedCycle.levels.map((level) => (
              <Button
                key={level.key}
                type="button"
                size="sm"
                variant={
                  level.key === selectedLevel?.key ? "default" : "outline"
                }
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
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {selectedLevel.classes.map((classe) => (
              <button
                key={classe.id}
                type="button"
                onClick={() => setClasseId(classe.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-left text-sm transition",
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
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {t("checkInUi.noClasses")}
          </p>
        )}
      </div>
    ) : null;

  let listContent: ReactNode;
  if (searching) {
    listContent = renderPersonList(
      searchResults,
      pending ? t("checkInUi.searching") : t("checkInUi.noPersonFound"),
    );
  } else if (tab === "teacher") {
    listContent = bootstrapLoading
      ? renderListSkeleton(6)
      : renderPersonList(teachers, t("checkInUi.noUpcomingTeachers"));
  } else if (tab === "student") {
    listContent = bootstrapLoading
      ? renderListSkeleton(6)
      : studentsLoading || (pending && students.length === 0)
        ? renderListSkeleton(6)
        : renderPersonList(students, t("checkInUi.noStudents"));
  } else {
    listContent =
      !personnelLoaded && pending
        ? renderListSkeleton(4)
        : renderPersonList(personnel, t("checkInUi.noPersonnel"));
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0 space-y-2 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-12 pl-9 text-base"
              placeholder={t("checkInUi.searchPlaceholder")}
              value={searchQuery}
              autoFocus
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && looksLikeScanCode(searchQuery)) {
                  event.preventDefault();
                  runScan(searchQuery);
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="lg"
              className="h-12 flex-1 touch-manipulation sm:flex-none"
              onClick={() => {
                setScanMode("card");
                setScanOpen(true);
              }}
            >
              <IconCamera className="mr-2 size-4" />
              {t("checkInUi.scanCard")}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-12 flex-1 touch-manipulation sm:flex-none"
              onClick={() => {
                setScanMode("face");
                setScanOpen(true);
              }}
            >
              <IconFaceId className="mr-2 size-4" />
              {t("checkInUi.scanFace")}
            </Button>
            <div className="hidden rounded-lg border bg-muted/40 px-3 py-1.5 text-right sm:block">
              <LiveClock />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="rounded-lg border bg-muted/40 px-3 py-1.5 sm:hidden">
            <LiveClock />
          </div>
          {visiblePeople.length > 0 ? (
            <div className="ml-auto flex items-center gap-1.5">
              <Badge variant="outline">
                {t("checkInUi.pendingCount", { count: pendingCount })}
              </Badge>
              <Badge variant="success">
                {t("checkInUi.doneCount", { count: checkedCount })}
              </Badge>
            </div>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label={t("checkInUi.title")}
          className={cn(
            "grid w-full gap-1 overflow-hidden rounded-lg bg-muted p-1",
            visibleTabs.length === 3 ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {(
            [
              {
                value: "teacher" as const,
                icon: IconUserCheck,
                label: t("checkInUi.tabTeachers"),
              },
              {
                value: "student" as const,
                icon: IconSchool,
                label: t("checkInUi.tabStudents"),
              },
              ...(canViewPersonnel
                ? [
                    {
                      value: "personnel" as const,
                      icon: IconUsers,
                      label: t("checkInUi.tabPersonnel"),
                    },
                  ]
                : []),
            ]
          ).map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(item.value)}
                className={cn(
                  "inline-flex min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-md px-2 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={16} className="hidden shrink-0 sm:block" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-h-0 flex-col gap-2">
          {studentFilters}
          {listContent}
        </div>

        <aside className="hidden min-h-0 lg:flex">
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="text-base">
                {t("checkInUi.recentTitle")}
              </CardTitle>
              <CardDescription>
                {t("checkInUi.recentDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {recent.length > 0 ? (
                recent.map(renderRecentItem)
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                  {t("checkInUi.recentEmpty")}
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {recent.length > 0 ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-0.5 lg:hidden">
          {recent.map((item) => (
            <div
              key={item.id}
              className="min-w-[12rem] rounded-lg border bg-card px-3 py-2"
            >
              <p className="truncate text-sm font-medium">
                {item.person?.name ?? t("checkInUi.personFallback")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.statusLabel ?? item.message}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <AttendanceScanDialog
        open={scanOpen}
        initialMode={scanMode}
        onOpenChange={setScanOpen}
        onScan={runScan}
        onFacePerson={(personType, personId) => {
          checkInPerson({
            id: personId,
            name: "",
            matricule: "",
            roleLabel: personTypeLabels[personType],
            personType,
          });
        }}
        disabled={pending}
        labels={{
          title: t("checkInUi.scanTitle"),
          card: t("checkInUi.scanModeCard"),
          face: t("checkInUi.scanModeFace"),
          cardDescription: t("checkInUi.cameraDescription"),
          faceDescription: t("checkInUi.faceDescription"),
          unknown: t("checkInUi.faceUnknown"),
          ambiguous: t("checkInUi.faceAmbiguous"),
          searchPlaceholder: t("checkInUi.faceSearchPlaceholder"),
          noPersonFound: t("checkInUi.noPersonFound"),
          retryFace: t("checkInUi.faceRetry"),
        }}
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
          requireEarlyExit={checkout.requireEarlyExit}
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
