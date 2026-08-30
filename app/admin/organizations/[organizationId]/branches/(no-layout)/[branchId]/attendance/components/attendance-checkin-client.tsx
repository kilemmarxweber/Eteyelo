"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconBarcode,
  IconCamera,
  IconKeyboard,
  IconLogout,
  IconScan,
  IconSearch,
  IconUserCheck,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  checkInByScanAction,
  checkInPersonByIdAction,
  findOpenCheckoutForPersonAction,
  searchPeopleForCheckInAction,
} from "../attendance-scan.action";
import type {
  AttendanceCheckInResult,
  AttendancePersonLookup,
  AttendancePersonType,
} from "../attendance-scan-types";
import { getCurrentPosition } from "../component/attendance.client";
import { AttendanceCheckoutDialog } from "./attendance-checkout-dialog";
import { AttendanceScanDialog } from "./attendance-scanner";

async function resolveCheckInCoords() {
  const position = await getCurrentPosition();
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

type RecentCheckIn = AttendanceCheckInResult & { id: string };
type PointageMode = "scan" | "manual";

type CheckoutTarget = {
  personType: AttendancePersonType;
  attendanceId: string;
  personName: string;
  sessionLabel?: string | null;
};

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
  const [mode, setMode] = useState<PointageMode>("manual");
  const [scanOpen, setScanOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<AttendancePersonLookup[]>([]);
  const [selected, setSelected] = useState<AttendancePersonLookup | null>(null);
  const [recent, setRecent] = useState<RecentCheckIn[]>([]);
  const [checkout, setCheckout] = useState<CheckoutTarget | null>(null);
  const [pending, startTransition] = useTransition();
  const lastScanRef = useRef<string>("");
  const lastScanAtRef = useRef(0);

  const fetchResults = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const items = await searchPeopleForCheckInAction(trimmed);
    setResults(items);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        try {
          await fetchResults(searchQuery);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : t("checkInUi.searchFailed"),
          );
        }
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [fetchResults, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      return;
    }

    const interval = window.setInterval(() => {
      startTransition(async () => {
        try {
          await fetchResults(searchQuery);
        } catch {
          // Ignore background refresh errors.
        }
      });
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [fetchResults, searchQuery]);

  useEffect(() => {
    if (!selected) return;

    const updated = results.find(
      (person) =>
        person.id === selected.id && person.personType === selected.personType,
    );

    if (updated) {
      setSelected(updated);
    }
  }, [results, selected]);

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
        setManualCode("");
        setSelected(null);
        setSearchQuery("");
        setResults([]);
        setScanOpen(false);
      } else {
        toast.error(result.message);
      }
    },
    [openCheckoutFromResult, pushRecent],
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
    [handleCheckInResult, pending],
  );

  function checkInSelected() {
    if (!selected) return;

    startTransition(async () => {
      try {
        const coords = await resolveCheckInCoords();
        const result = await checkInPersonByIdAction(
          selected.personType,
          selected.id,
          coords,
        );
        handleCheckInResult(result);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("checkInUi.checkInFailed"),
        );
      }
    });
  }

  function checkOutSelected() {
    if (!selected) return;

    startTransition(async () => {
      try {
        const result = await findOpenCheckoutForPersonAction(
          selected.personType,
          selected.id,
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
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight">{t("checkInUi.title")}</h2>
          <p className="mt-1 w-full max-w-7xl text-sm leading-relaxed text-muted-foreground">
            {t("checkInUi.description")}
          </p>
        </div>
        <Button
          type="button"
          className="w-full shrink-0 lg:w-auto"
          onClick={() => setScanOpen(true)}
        >
          <IconCamera className="mr-2 size-4" />
          {t("checkInUi.scanCard")}
        </Button>
      </div>

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as PointageMode)}
        className="space-y-4"
      >
        <div className="sticky top-0 z-10 rounded-xl border bg-card/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TabsList className="grid h-auto min-h-11 w-full grid-cols-2 border border-primary/20 bg-primary/10">
            <TabsTrigger
              value="manual"
              className="gap-1.5 py-2.5 text-sm text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <IconKeyboard size={16} className="shrink-0" />
              {t("checkInUi.manualTab")}
            </TabsTrigger>
            <TabsTrigger
              value="scan"
              className="gap-1.5 py-2.5 text-sm text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <IconScan size={16} className="shrink-0" />
              {t("checkInUi.scanTab")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="manual" className="mt-0">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t("checkInUi.manualTitle")}</CardTitle>
              <CardDescription className="w-full max-w-7xl text-pretty">
                {t("checkInUi.manualDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("checkInUi.matriculeLabel")}
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      placeholder={t("checkInUi.matriculePlaceholder")}
                      value={manualCode}
                      onChange={(event) => setManualCode(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") runScan(manualCode);
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => runScan(manualCode)}
                      disabled={pending || !manualCode.trim()}
                    >
                      <IconBarcode className="mr-2 size-4" />
                      {t("checkIn")}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("checkInUi.searchLabel")}
                  </label>
                  <div className="relative">
                    <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder={t("checkInUi.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              {results.length > 0 ? (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {results.map((person) => {
                    const isSelected =
                      selected?.id === person.id &&
                      selected?.personType === person.personType;
                    return (
                      <button
                        key={`${person.personType}-${person.id}`}
                        type="button"
                        onClick={() => setSelected(person)}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{person.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {person.matricule} • {person.roleLabel}
                          </p>
                          {person.expectedSessionLabel ? (
                            <p className="mt-0.5 truncate text-xs text-primary">
                              {t("checkInUi.expectedSession", {
                                session: person.expectedSessionLabel,
                              })}
                            </p>
                          ) : null}
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          <Badge variant="outline">
                            {personTypeLabels[person.personType]}
                          </Badge>
                          {isSelected ? (
                            <Badge variant="outline-primary">{t("checkInUi.selected")}</Badge>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : searchQuery.trim().length >= 2 && !pending ? (
                <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  {t("checkInUi.noPersonFound")}
                </p>
              ) : null}

              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={checkInSelected}
                  disabled={pending || !selected}
                >
                  <IconUserCheck className="mr-2 size-4" />
                  {t("checkInUi.checkInArrival")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={checkOutSelected}
                  disabled={pending || !selected}
                >
                  <IconLogout className="mr-2 size-4" />
                  {t("checkInUi.checkOutDeparture")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scan" className="mt-0">
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-start gap-4 px-6 py-10 sm:px-8">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <IconCamera className="size-8" />
              </div>
              <div className="w-full space-y-1">
                <h3 className="text-base font-semibold">{t("checkInUi.cameraTitle")}</h3>
                <p className="w-full max-w-7xl text-sm leading-relaxed text-muted-foreground">
                  {t("checkInUi.cameraDescription")}
                </p>
              </div>
              <Button type="button" onClick={() => setScanOpen(true)}>
                <IconScan className="mr-2 size-4" />
                {t("checkInUi.openCamera")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {recent.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("checkInUi.recentTitle")}</CardTitle>
            <CardDescription className="w-full max-w-7xl">
              {t("checkInUi.recentDescription")}
            </CardDescription>
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
                id: checkout.attendanceId,
                name: checkout.personName,
                matricule: "",
                roleLabel: personTypeLabels[checkout.personType],
                personType: checkout.personType,
              },
              statusLabel: t("status.checkout"),
              sessionLabel: checkout.sessionLabel ?? undefined,
            });
            setCheckout(null);
            setSelected(null);
            setSearchQuery("");
            setResults([]);
            setManualCode("");
          }}
        />
      ) : null}
    </div>
  );
}
