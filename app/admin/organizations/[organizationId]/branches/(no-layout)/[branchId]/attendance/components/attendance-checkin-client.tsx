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
  IconFileTypePdf,
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
  getLiveCheckInStatesAction,
  listPersonnelForCheckInAction,
  listStudentsForClassCheckInAction,
  searchPeopleForCheckInAction,
} from "../attendance-scan.action";
import {
  kioskCheckInByScanAction,
  kioskCheckInPersonByIdAction,
  kioskFindOpenCheckoutForPersonAction,
  kioskGetQuickCheckInBootstrapAction,
  kioskGetLiveCheckInStatesAction,
  kioskListPersonnelForCheckInAction,
  kioskListStudentsForClassCheckInAction,
  kioskSearchPeopleForCheckInAction,
} from "@/app/attendance/[branchId]/kiosk.action";
import type {
  AttendanceCheckInCycleGroup,
  AttendanceCheckInResult,
  AttendanceLiveCheckInState,
  AttendancePersonLookup,
  AttendancePersonType,
} from "../attendance-scan-types";
import { getCurrentGeoCoords } from "../component/attendance.client";
import { AttendanceCheckoutDialog } from "./attendance-checkout-dialog";
import { AttendanceClassFilters } from "./attendance-class-filters";
import { downloadTodayAttendancePdf } from "./attendance-checkin-pdf";
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

function applyLiveStates(
  people: AttendancePersonLookup[],
  states: Map<string, AttendanceLiveCheckInState>,
) {
  return people.map((person) => {
    const live = states.get(personKey(person));
    if (!live) {
      return person;
    }
    return {
      ...person,
      alreadyCheckedIn: live.alreadyCheckedIn,
      canCheckOut: live.canCheckOut,
      attendanceId: live.attendanceId,
      canCheckIn: live.canCheckIn ?? person.canCheckIn,
      requiresEarlyExit: live.requiresEarlyExit ?? person.requiresEarlyExit,
      periodEndAt: live.periodEndAt ?? person.periodEndAt,
      checkInAt: live.checkInAt ?? person.checkInAt,
    };
  });
}

function mergePeople(
  next: AttendancePersonLookup[],
  previous: AttendancePersonLookup[],
) {
  const previousByKey = new Map(
    previous.map((person) => [personKey(person), person]),
  );
  return next.map((person) => {
    const existing = previousByKey.get(personKey(person));
    if (!existing) return person;
    return {
      ...person,
      alreadyCheckedIn: existing.alreadyCheckedIn,
      canCheckOut: existing.canCheckOut,
      attendanceId: existing.attendanceId,
      canCheckIn: person.canCheckIn ?? existing.canCheckIn,
      requiresEarlyExit: person.requiresEarlyExit ?? existing.requiresEarlyExit,
      periodEndAt: person.periodEndAt ?? existing.periodEndAt,
      checkInAt: person.checkInAt ?? existing.checkInAt,
    };
  });
}

type StoredCheckInNav = {
  tab?: PointageTab;
  cycleKey?: string;
  levelKey?: string;
  classeId?: string;
};

function navStorageKey(kioskBranchId?: string) {
  return `eteyelo:attendance-nav:${kioskBranchId ?? "session"}`;
}

function readStoredNav(kioskBranchId?: string): StoredCheckInNav | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(navStorageKey(kioskBranchId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredCheckInNav;
  } catch {
    return null;
  }
}

function writeStoredNav(kioskBranchId: string | undefined, nav: StoredCheckInNav) {
  try {
    window.sessionStorage.setItem(
      navStorageKey(kioskBranchId),
      JSON.stringify(nav),
    );
  } catch {
    // sessionStorage peut être indisponible (kiosque verrouillé).
  }
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

export function AttendanceCheckInClient({
  kioskBranchId,
}: {
  kioskBranchId?: string;
} = {}) {
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
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recent, setRecent] = useState<RecentCheckIn[]>([]);
  const [checkout, setCheckout] = useState<CheckoutTarget | null>(null);
  const [pending, startTransition] = useTransition();
  const lastScanRef = useRef<string>("");
  const lastScanAtRef = useRef(0);
  const didInitNav = useRef(false);
  const studentsByClassRef = useRef(new Map<string, AttendancePersonLookup[]>());
  const classeIdRef = useRef(classeId);
  classeIdRef.current = classeId;

  const searching = searchQuery.trim().length >= 2;

  const loadBootstrap = useCallback(async () => {
    const data = kioskBranchId
      ? await kioskGetQuickCheckInBootstrapAction(kioskBranchId)
      : await getQuickCheckInBootstrapAction();
    setTeachers((previous) => mergePeople(data.teachers, previous));
    setCycles(data.cycles);
    setCanViewPersonnel(data.canViewPersonnel);
    return data;
  }, [kioskBranchId]);

  const fetchSearchResults = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const items = kioskBranchId
        ? await kioskSearchPeopleForCheckInAction(kioskBranchId, trimmed)
        : await searchPeopleForCheckInAction(trimmed);
      setSearchResults(items);
    } finally {
      setSearchLoading(false);
    }
  }, [kioskBranchId]);

  const loadStudents = useCallback(async (nextClasseId: string) => {
    if (!nextClasseId) {
      setStudents([]);
      return;
    }
    const cached = studentsByClassRef.current.get(nextClasseId);
    if (cached) {
      setStudents(cached);
      setStudentsLoading(false);
    } else {
      setStudentsLoading(true);
    }
    try {
      const items = kioskBranchId
        ? await kioskListStudentsForClassCheckInAction(kioskBranchId, nextClasseId)
        : await listStudentsForClassCheckInAction(nextClasseId);
      studentsByClassRef.current.set(nextClasseId, items);
      setStudents(items);
    } finally {
      setStudentsLoading(false);
    }
  }, [kioskBranchId]);

  const loadPersonnel = useCallback(async () => {
    const items = kioskBranchId
      ? await kioskListPersonnelForCheckInAction(kioskBranchId)
      : await listPersonnelForCheckInAction();
    setPersonnel((previous) =>
      previous.length ? mergePeople(items, previous) : items,
    );
    setPersonnelLoaded(true);
  }, [kioskBranchId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await loadBootstrap();
        if (cancelled || didInitNav.current) return;
        didInitNav.current = true;
        const stored = readStoredNav(kioskBranchId);
        const cycle =
          data.cycles.find((item) => item.key === stored?.cycleKey) ??
          data.cycles[0];
        const level =
          cycle?.levels.find((item) => item.key === stored?.levelKey) ??
          cycle?.levels[0];
        const classe =
          level?.classes.find((item) => item.id === stored?.classeId) ??
          level?.classes.find((item) => item.hasUpcomingSession) ??
          level?.classes[0];
        if (
          stored?.tab === "teacher" ||
          stored?.tab === "student" ||
          (stored?.tab === "personnel" && data.canViewPersonnel)
        ) {
          setTab(stored.tab);
        }
        if (cycle) setCycleKey(cycle.key);
        if (level) setLevelKey(level.key);
        if (classe) setClasseId(classe.id);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("checkInUi.searchFailed"),
        );
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kioskBranchId, loadBootstrap, t]);

  useEffect(() => {
    if (bootstrapLoading) return;
    writeStoredNav(kioskBranchId, { tab, cycleKey, levelKey, classeId });
  }, [bootstrapLoading, classeId, cycleKey, kioskBranchId, levelKey, tab]);

  useEffect(() => {
    if (!searching) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetchSearchResults(searchQuery).catch((error) => {
        toast.error(
          error instanceof Error ? error.message : t("checkInUi.searchFailed"),
        );
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [fetchSearchResults, searchQuery, searching, t]);

  useEffect(() => {
    if (tab !== "student" || !classeId || searching) return;
    void loadStudents(classeId).catch((error) => {
      toast.error(
        error instanceof Error ? error.message : t("checkInUi.searchFailed"),
      );
    });
  }, [classeId, loadStudents, searching, t, tab]);

  useEffect(() => {
    if (tab !== "personnel" || personnelLoaded || searching) return;
    void loadPersonnel().catch((error) => {
      toast.error(
        error instanceof Error ? error.message : t("checkInUi.searchFailed"),
      );
    });
  }, [loadPersonnel, personnelLoaded, searching, t, tab]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadBootstrap().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [loadBootstrap]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function refreshLive() {
      if (
        cancelled ||
        inFlight ||
        document.visibilityState === "hidden" ||
        pending ||
        busyKey ||
        checkout
      ) {
        return;
      }
      inFlight = true;
      try {
        const snapshot = kioskBranchId
          ? await kioskGetLiveCheckInStatesAction(kioskBranchId)
          : await getLiveCheckInStatesAction();
        if (cancelled) return;
        const states = new Map(
          snapshot.states.map((item) => [
            `${item.personType}-${item.personId}`,
            item,
          ]),
        );
        setTeachers((people) => applyLiveStates(people, states));
        setStudents((people) => {
          const next = applyLiveStates(people, states);
          const currentClasseId = classeIdRef.current;
          if (currentClasseId) {
            studentsByClassRef.current.set(currentClasseId, next);
          }
          return next;
        });
        setPersonnel((people) => applyLiveStates(people, states));
        setSearchResults((people) => applyLiveStates(people, states));
        setRecent(
          snapshot.recent.map((item) => ({
            id: `${item.personType}-${item.personId}-${item.checkedAt}`,
            ok: true,
            message: "",
            personType: item.personType,
            person: {
              id: item.personId,
              name: item.personName,
              matricule: "",
              roleLabel: "",
              personType: item.personType,
            },
            status: item.status,
            statusLabel: item.statusLabel,
            checkedAt: item.checkedAt,
            attendanceId: item.attendanceId,
          })),
        );
      } catch {
        // Le kiosque continue d'afficher le dernier état connu.
      } finally {
        inFlight = false;
      }
    }

    const intervalMs = kioskBranchId ? 3000 : 12_000;
    const interval = window.setInterval(() => {
      void refreshLive();
    }, intervalMs);
    void refreshLive();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshLive();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [busyKey, checkout, kioskBranchId, pending]);

  const selectedCycle = cycles.find((item) => item.key === cycleKey);
  const selectedLevel = selectedCycle?.levels.find((item) => item.key === levelKey);

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
          checkInAt: result.checkedAt ?? new Date().toISOString(),
          expectedSessionLabel:
            result.sessionLabel ?? result.person.expectedSessionLabel,
        });
      }
      setScanOpen(false);
    },
    [markPersonState, openCheckoutFromResult, pushRecent],
  );

  const printPdf = useCallback(
    async (kind: "teachers" | "personnel" | "students", classeIdToPrint?: string) => {
      const key =
        kind === "students"
          ? `class:${classeIdToPrint ?? ""}`
          : kind;
      setPdfBusyKey(key);
      try {
        await downloadTodayAttendancePdf({
          kind,
          classeId: classeIdToPrint,
          kioskBranchId,
          t,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("reports.pdfError"),
        );
      } finally {
        setPdfBusyKey(null);
      }
    },
    [kioskBranchId, t],
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
          const result = kioskBranchId
            ? await kioskCheckInByScanAction(kioskBranchId, value, coords)
            : await checkInByScanAction(value, coords);
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
    [handleCheckInResult, kioskBranchId, pending, t],
  );

  function checkInPerson(person: AttendancePersonLookup) {
    if (person.canCheckIn === false) return;
    if (person.periodEndAt) {
      const end = new Date(person.periodEndAt).getTime();
      if (Number.isFinite(end) && Date.now() >= end) return;
    }
    const key = personKey(person);
    setBusyKey(key);
    startTransition(async () => {
      try {
        const coords = await resolveCheckInCoords();
        const result = kioskBranchId
          ? await kioskCheckInPersonByIdAction(
              kioskBranchId,
              person.personType,
              person.id,
              coords,
            )
          : await checkInPersonByIdAction(
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
        const result = kioskBranchId
          ? await kioskFindOpenCheckoutForPersonAction(
              kioskBranchId,
              person.personType,
              person.id,
            )
          : await findOpenCheckoutForPersonAction(
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
              earlyExitLabel={t("checkout.earlyExit")}
              endOfClassLabel={
                person.personType === "personnel"
                  ? t("checkout.normalEnd")
                  : t("checkInUi.endOfClass")
              }
              doneLabel={t("checkInUi.checkedIn")}
              absentLabel={t("status.ABSENT")}
              arrivalLabel={t("reports.columns.arrival")}
              sessionLabel={
                person.expectedSessionLabel
                  ? t("checkInUi.expectedSession", {
                      session: person.expectedSessionLabel,
                    })
                  : null
              }
              blockedReason={
                person.canCheckIn === false && !person.canCheckOut
                  ? t("checkInUi.noStudentSessionToday")
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
  const pendingCount = visiblePeople.filter((person) => {
    if (person.alreadyCheckedIn) return false;
    if (person.canCheckIn === false) return false;
    if (person.periodEndAt) {
      const end = new Date(person.periodEndAt).getTime();
      if (Number.isFinite(end) && Date.now() >= end) return false;
    }
    return true;
  }).length;

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
      <AttendanceClassFilters
        cycles={cycles}
        selectedCycle={selectedCycle}
        selectedLevel={selectedLevel}
        selectedClasseId={classeId}
        printingClassId={
          pdfBusyKey?.startsWith("class:")
            ? pdfBusyKey.slice("class:".length)
            : null
        }
        labels={{
          cycle: t("checkInUi.filterCycle"),
          level: t("checkInUi.filterLevel"),
          classe: t("checkInUi.filterClass"),
          studentsCount: (count) => t("checkInUi.studentsCount", { count }),
          printPdf: t("checkInUi.printPdf"),
          noClasses: t("checkInUi.noClasses"),
        }}
        onSelectCycle={(cycle) => {
          setCycleKey(cycle.key);
          const nextLevel = cycle.levels[0];
          setLevelKey(nextLevel?.key ?? "");
          const nextClass =
            nextLevel?.classes.find((item) => item.hasUpcomingSession) ??
            nextLevel?.classes[0];
          setClasseId(nextClass?.id ?? "");
        }}
        onSelectLevel={(level) => {
          setLevelKey(level.key);
          const nextClass =
            level.classes.find((item) => item.hasUpcomingSession) ??
            level.classes[0];
          setClasseId(nextClass?.id ?? "");
        }}
        onSelectClass={setClasseId}
        onPrintClass={(nextClasseId) => {
          void printPdf("students", nextClasseId);
        }}
      />
    ) : null;

  let listContent: ReactNode;
  if (searching) {
    listContent = renderPersonList(
      searchResults,
      searchLoading ? t("checkInUi.searching") : t("checkInUi.noPersonFound"),
    );
  } else if (tab === "teacher") {
    listContent = bootstrapLoading
      ? renderListSkeleton(6)
      : renderPersonList(teachers, t("checkInUi.noUpcomingTeachers"));
  } else if (tab === "student") {
    listContent = bootstrapLoading
      ? renderListSkeleton(6)
      : studentsLoading && students.length === 0
        ? renderListSkeleton(6)
        : renderPersonList(students, t("checkInUi.noStudents"));
  } else {
    listContent =
      !personnelLoaded && personnel.length === 0
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
              className="h-12 pl-9 text-base md:h-14 md:text-[1.05rem]"
              placeholder={t("checkInUi.searchPlaceholder")}
              value={searchQuery}
              autoFocus={!kioskBranchId}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && looksLikeScanCode(searchQuery)) {
                  event.preventDefault();
                  runScan(searchQuery);
                }
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              type="button"
              size="lg"
              className="h-12 touch-manipulation md:h-14"
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
              className="h-12 touch-manipulation md:h-14"
              onClick={() => {
                setScanMode("face");
                setScanOpen(true);
              }}
            >
              <IconFaceId className="mr-2 size-4" />
              {t("checkInUi.scanFace")}
            </Button>
            {kioskBranchId ? null : (
              <div className="hidden rounded-lg border bg-muted/40 px-3 py-1.5 text-right sm:block">
                <LiveClock />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {kioskBranchId ? null : (
            <div className="rounded-lg border bg-muted/40 px-3 py-1.5 sm:hidden">
              <LiveClock />
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {!searching && tab === "teacher" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 text-red-600 hover:bg-red-500/10 hover:text-red-600"
                aria-label={t("checkInUi.printPdf")}
                title={t("checkInUi.printPdf")}
                disabled={pdfBusyKey === "teachers"}
                onClick={() => void printPdf("teachers")}
              >
                <IconFileTypePdf className="size-5" />
              </Button>
            ) : null}
            {!searching && tab === "personnel" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 text-red-600 hover:bg-red-500/10 hover:text-red-600"
                aria-label={t("checkInUi.printPdf")}
                title={t("checkInUi.printPdf")}
                disabled={pdfBusyKey === "personnel"}
                onClick={() => void printPdf("personnel")}
              >
                <IconFileTypePdf className="size-5" />
              </Button>
            ) : null}
            {visiblePeople.length > 0 ? (
              <>
                <Badge variant="outline">
                  {t("checkInUi.pendingCount", { count: pendingCount })}
                </Badge>
                <Badge variant="success">
                  {t("checkInUi.doneCount", { count: checkedCount })}
                </Badge>
              </>
            ) : null}
          </div>
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
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-h-0 flex-col gap-2">
          {studentFilters}
          {listContent}
        </div>

        <aside className="hidden min-h-0 md:flex">
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
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-0.5 md:hidden">
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
        kioskBranchId={kioskBranchId}
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
          tabAll: t("checkInUi.tabAll"),
          personTypes: personTypeLabels,
        }}
      />

      {checkout ? (
        <AttendanceCheckoutDialog
          open={Boolean(checkout)}
          kioskBranchId={kioskBranchId}
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
