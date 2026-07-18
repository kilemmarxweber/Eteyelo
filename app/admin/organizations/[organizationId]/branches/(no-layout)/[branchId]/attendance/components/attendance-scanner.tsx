"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { IconCamera, IconCameraOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type AttendanceScannerProps = {
  onScan: (value: string) => void;
  disabled?: boolean;
};

function buildReader() {
  // BrowserMultiFormatReader without format hints supports all 1D/2D barcode types.
  return new BrowserMultiFormatReader(undefined, {
    delayBetweenScanAttempts: 80,
    delayBetweenScanSuccess: 2000,
    tryPlayVideoTimeout: 12000,
  });
}

export function AttendanceScanner({ onScan, disabled = false }: AttendanceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const onScanRef = useRef(onScan);
  const [active, setActive] = useState(false);
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
        requestAnimationFrame(() => resolve());
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
      <div className="relative overflow-hidden rounded-lg border bg-black">
        {active ? (
          <>
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full object-cover"
              muted
              autoPlay
              playsInline
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-28 w-[82%] rounded-md border-2 border-white/80 bg-white/5" />
            </div>
            <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs text-white/90">
              Alignez n&apos;importe quel code-barres ou QR dans le cadre
            </p>
          </>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted/30 px-4 text-center text-sm text-muted-foreground">
            Appuyez sur le bouton ci-dessous pour activer la camera
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
            Arreter le scan
          </>
        ) : (
          <>
            <IconCamera className="mr-2 size-4 shrink-0" />
            Activer le scan camera
          </>
        )}
      </Button>
    </div>
  );
}
