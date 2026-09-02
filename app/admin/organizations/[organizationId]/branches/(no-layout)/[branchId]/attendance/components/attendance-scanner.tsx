"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { IconCamera, IconCameraOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";

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

export function AttendanceScanDialog({
  open,
  onOpenChange,
  onScan,
  disabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Scanner une carte"
        size="sm"
        overlayClassName="z-[110]"
        className="z-[110] gap-3 p-5"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogDescription className="text-sm leading-relaxed text-foreground">
          Autorisez la caméra, puis alignez le QR ou le code-barres dans le cadre.
        </DialogDescription>
        {open ? (
          <AttendanceScanner
            autoStart
            hideToggle
            onScan={onScan}
            disabled={disabled}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
