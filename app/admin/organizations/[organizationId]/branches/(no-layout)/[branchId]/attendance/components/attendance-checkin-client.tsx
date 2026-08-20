"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconBarcode,
  IconKeyboard,
  IconLogout,
  IconScan,
  IconUserCheck,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { AttendanceScanner } from "./attendance-scanner";

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

const personTypeLabels: Record<AttendancePersonType, string> = {
  student: "Eleve",
  teacher: "Enseignant",
  personnel: "Personnel",
};

export function AttendanceCheckInClient() {
  const [mode, setMode] = useState<PointageMode>("scan");
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
            error instanceof Error ? error.message : "Recherche impossible.",
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
            toast.error("Aucune information trouvee.");
            return;
          }
          handleCheckInResult(result);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Pointage impossible. Activez la geolocalisation.",
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
            : "Pointage impossible. Activez la geolocalisation.",
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
          toast.error("Aucune présence ouverte trouvée.");
          return;
        }
        handleCheckInResult(result);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Impossible de préparer la sortie.",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Pointage</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Scannez pour l&apos;arrivée. Un second scan (ou « Pointer sortie »)
          ouvre l&apos;encodage de sortie — normale ou anticipée avec motif.
        </p>
      </div>

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as PointageMode)}
        className="space-y-4"
      >
        <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="hidden min-h-9 w-full lg:block lg:max-w-md"
            aria-hidden
          />
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 border border-primary/20 bg-primary/10 lg:w-auto">
            <TabsTrigger
              value="scan"
              className="gap-1.5 text-xs text-primary/70 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <IconScan size={16} className="shrink-0" />
              Scan
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="gap-1.5 text-xs text-primary/70 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <IconKeyboard size={16} className="shrink-0" />
              Manuel
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="scan" className="mt-0 space-y-4">
          <AttendanceScanner onScan={runScan} disabled={pending} />
          <p className="text-xs text-muted-foreground">
            Placez le code-barres ou le QR code de la carte devant la camera. Si
            la personne est déjà arrivée, le scan propose d&apos;encoder la
            sortie.
          </p>
        </TabsContent>

        <TabsContent value="manual" className="mt-0 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Matricule ou code carte</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="ELV-..., ENS-..., PRS-... ou matricule..."
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
                Pointer
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Rechercher une personne</label>
            <Input
              placeholder="Nom, prenom ou matricule..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map((person) => (
                <button
                  key={`${person.personType}-${person.id}`}
                  type="button"
                  onClick={() => setSelected(person)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    selected?.id === person.id &&
                    selected?.personType === person.personType
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div>
                    <p className="font-medium">{person.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {person.matricule} • {person.roleLabel}
                    </p>
                    {person.expectedSessionLabel ? (
                      <p className="text-xs text-primary">
                        Cours prevu: {person.expectedSessionLabel}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {personTypeLabels[person.personType]}
                    </Badge>
                    {selected?.id === person.id &&
                    selected?.personType === person.personType ? (
                      <Badge variant="outline-primary">Selectionne</Badge>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={checkInSelected}
              disabled={pending || !selected}
            >
              <IconUserCheck className="mr-2 size-4" />
              Pointer arrivée
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={checkOutSelected}
              disabled={pending || !selected}
            >
              <IconLogout className="mr-2 size-4" />
              Pointer sortie
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {recent.length > 0 ? (
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">Derniers pointages</h3>
          <div className="space-y-2">
            {recent.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm"
              >
                <span className="font-medium">
                  {item.person?.name ?? "Personne"}
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
          </div>
        </div>
      ) : null}

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
              statusLabel: "Sortie",
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
