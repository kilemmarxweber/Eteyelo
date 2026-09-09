"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { IconCamera, IconCameraOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  enrollFaceDescriptorAction,
  matchFaceDescriptorAction,
  searchPeopleForFaceEnrollAction,
} from "../attendance-scan.action";
import {
  kioskEnrollFaceDescriptorAction,
  kioskMatchFaceDescriptorAction,
  kioskSearchPeopleForFaceEnrollAction,
} from "@/app/attendance/[branchId]/kiosk.action";
import type {
  AttendancePersonLookup,
  AttendancePersonType,
} from "../attendance-scan-types";
import { AttendanceFaceCamera } from "./attendance-face-camera";

type AttendanceScannerProps = {
  onScan: (value: string) => void;
  disabled?: boolean;
  /** Démarre la caméra dès l’affichage (popup scan). */
  autoStart?: boolean;
  /** Cache le bouton activer/arrêter (la popup gère la fermeture). */
  hideToggle?: boolean;
};

function buildReader() {
  // BrowserMultiFormatReader without format hints supports all 1D/2D barcode types.
  return new BrowserMultiFormatReader(undefined, {
    delayBetweenScanAttempts: 80,
    delayBetweenScanSuccess: 2000,
    tryPlayVideoTimeout: 12000,
  });
}

export function AttendanceScanner({
  onScan,
  disabled = false,
  autoStart = false,
  hideToggle = false,
}: AttendanceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const onScanRef = useRef(onScan);
  const [active, setActive] = useState(autoStart);
  const [error, setError] = useState<string | null>(null);

  onScanRef.current = onScan;

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;

    const video = videoRef.current;
    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!active || disabled) {
      stopScanner();
      return;
    }

    let cancelled = false;

    async function startScanner() {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 180);
      });

      const video = videoRef.current;
      if (!video || cancelled) return;

      try {
        const reader = buildReader();

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920, min: 640 },
              height: { ideal: 1080, min: 480 },
            },
          },
          video,
          (result) => {
            const value = result?.getText()?.trim();
            if (value) onScanRef.current(value);
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setError(null);
      } catch {
        if (cancelled) return;

        try {
          const reader = buildReader();
          const controls = await reader.decodeFromVideoDevice(
            undefined,
            video,
            (result) => {
              const value = result?.getText()?.trim();
              if (value) onScanRef.current(value);
            },
          );

          if (cancelled) {
            controls.stop();
            return;
          }

          controlsRef.current = controls;
          setError(null);
        } catch {
          setError(
            "Camera indisponible. Autorisez la camera ou utilisez la saisie manuelle.",
          );
          setActive(false);
        }
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [active, disabled, stopScanner]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border bg-black">
        {active ? (
          <>
            <video
              ref={videoRef}
              className="aspect-[4/3] max-h-[min(52dvh,22rem)] w-full object-cover"
              muted
              autoPlay
              playsInline
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-32 w-[78%] rounded-lg border-2 border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
            </div>
            <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs font-medium text-white/95">
              Alignez le code-barres ou le QR dans le cadre
            </p>
          </>
        ) : (
          <div className="flex aspect-[4/3] max-h-[min(52dvh,22rem)] w-full flex-col items-center justify-center gap-2 bg-muted/40 px-4 text-center text-sm text-muted-foreground">
            <IconCamera className="size-8 opacity-50" />
            {error
              ? "Caméra indisponible"
              : "Appuyez pour activer la caméra"}
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {hideToggle ? null : (
        <Button
          type="button"
          variant={active ? "outline" : "default"}
          onClick={() => {
            if (active) {
              stopScanner();
              setActive(false);
              return;
            }

            setError(null);
            setActive(true);
          }}
          disabled={disabled}
          className="w-full sm:w-auto"
        >
          {active ? (
            <>
              <IconCameraOff className="mr-2 size-4 shrink-0" />
              Arrêter le scan
            </>
          ) : (
            <>
              <IconCamera className="mr-2 size-4 shrink-0" />
              Activer la caméra
            </>
          )}
        </Button>
      )}
    </div>
  );
}

type ScanMode = "card" | "face";

export function AttendanceScanDialog({
  open,
  onOpenChange,
  onScan,
  onFacePerson,
  disabled = false,
  initialMode = "card",
  kioskBranchId,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (value: string) => void;
  onFacePerson: (personType: AttendancePersonType, personId: string) => void;
  disabled?: boolean;
  initialMode?: ScanMode;
  kioskBranchId?: string;
  labels: {
    title: string;
    card: string;
    face: string;
    cardDescription: string;
    faceDescription: string;
    unknown: string;
    ambiguous: string;
    searchPlaceholder: string;
    noPersonFound: string;
    retryFace: string;
    tabAll: string;
    personTypes: Record<AttendancePersonType, string>;
  };
}) {
  const [mode, setMode] = useState<ScanMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [enrollDescriptor, setEnrollDescriptor] = useState<number[] | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | AttendancePersonType>(
    "all",
  );
  const [results, setResults] = useState<AttendancePersonLookup[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const typeFilters: Array<{
    id: "all" | AttendancePersonType;
    label: string;
  }> = [
    { id: "all", label: labels.tabAll },
    { id: "student", label: labels.personTypes.student },
    { id: "teacher", label: labels.personTypes.teacher },
    { id: "personnel", label: labels.personTypes.personnel },
  ];

  const visibleResults =
    typeFilter === "all"
      ? results
      : results.filter((person) => person.personType === typeFilter);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setEnrollDescriptor(null);
      setQuery("");
      setTypeFilter("all");
      setResults([]);
      setHint(null);
      setBusy(false);
    }
  }, [open, initialMode]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enrollDescriptor || trimmed.length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void (kioskBranchId
        ? kioskSearchPeopleForFaceEnrollAction(kioskBranchId, trimmed)
        : searchPeopleForFaceEnrollAction(trimmed)
      )
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [enrollDescriptor, kioskBranchId, query]);

  async function handleDescriptor(descriptor: number[]) {
    if (busy || disabled || enrollDescriptor) return;
    setBusy(true);
    setHint(null);
    try {
      const match = kioskBranchId
        ? await kioskMatchFaceDescriptorAction(kioskBranchId, descriptor)
        : await matchFaceDescriptorAction(descriptor);
      if (match.matched) {
        onFacePerson(match.personType, match.personId);
        return;
      }
      if (match.reason === "ambiguous") {
        setHint(labels.ambiguous);
        return;
      }
      setEnrollDescriptor(descriptor);
      setHint(labels.unknown);
    } catch (error) {
      setHint(error instanceof Error ? error.message : labels.unknown);
    } finally {
      setBusy(false);
    }
  }

  async function enrollPerson(person: AttendancePersonLookup) {
    if (!enrollDescriptor || busy) return;
    setBusy(true);
    try {
      const result = kioskBranchId
        ? await kioskEnrollFaceDescriptorAction(kioskBranchId, {
            personType: person.personType,
            personId: person.id,
            descriptor: enrollDescriptor,
          })
        : await enrollFaceDescriptorAction({
            personType: person.personType,
            personId: person.id,
            descriptor: enrollDescriptor,
          });
      if (!result.ok) {
        setHint(result.message);
        return;
      }
      setEnrollDescriptor(null);
      setQuery("");
      setTypeFilter("all");
      setResults([]);
      onFacePerson(person.personType, person.id);
    } catch (error) {
      setHint(error instanceof Error ? error.message : labels.unknown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={labels.title}
        size="md"
        overlayClassName="z-[110]"
        className="z-[110] gap-3 p-5"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "card" ? "default" : "ghost"}
            onClick={() => {
              setMode("card");
              setEnrollDescriptor(null);
              setHint(null);
            }}
          >
            {labels.card}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "face" ? "default" : "ghost"}
            onClick={() => {
              setMode("face");
              setHint(null);
            }}
          >
            {labels.face}
          </Button>
        </div>

        <DialogDescription className="text-sm leading-relaxed text-foreground">
          {mode === "card" ? labels.cardDescription : labels.faceDescription}
        </DialogDescription>

        {open && mode === "card" ? (
          <AttendanceScanner
            autoStart
            hideToggle
            onScan={onScan}
            disabled={disabled}
          />
        ) : null}

        {open && mode === "face" ? (
          <div className="space-y-3">
            <AttendanceFaceCamera
              paused={busy || disabled || Boolean(enrollDescriptor)}
              onDescriptor={(descriptor) => void handleDescriptor(descriptor)}
            />
            {hint ? (
              <p className="text-sm text-muted-foreground">{hint}</p>
            ) : null}
            {enrollDescriptor ? (
              <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={labels.searchPlaceholder}
                  autoFocus
                />
                <div className="flex flex-wrap gap-1">
                  {typeFilters.map((filter) => (
                    <Button
                      key={filter.id}
                      type="button"
                      size="sm"
                      variant={typeFilter === filter.id ? "default" : "outline"}
                      className={cn("h-7 px-2 text-xs")}
                      onClick={() => setTypeFilter(filter.id)}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
                {visibleResults.length === 0 && query.trim().length >= 2 ? (
                  <p className="text-sm text-muted-foreground">
                    {labels.noPersonFound}
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {visibleResults.map((person) => {
                      const typeLabel = labels.personTypes[person.personType];
                      const extra =
                        person.roleLabel && person.roleLabel !== typeLabel
                          ? ` · ${person.roleLabel}`
                          : "";
                      return (
                        <Button
                          key={`${person.personType}-${person.id}`}
                          type="button"
                          variant="outline"
                          className="h-auto w-full justify-start py-2 text-left"
                          disabled={busy}
                          onClick={() => void enrollPerson(person)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {person.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {typeLabel}
                              {extra} · {person.matricule}
                            </span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEnrollDescriptor(null);
                    setQuery("");
                    setTypeFilter("all");
                    setResults([]);
                    setHint(null);
                  }}
                >
                  {labels.retryFace}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
