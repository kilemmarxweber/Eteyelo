"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

type CameraCaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  title?: string;
};

async function waitForVideoElement(
  getVideo: () => HTMLVideoElement | null,
  timeoutMs = 4000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const video = getVideo();
    if (video) return video;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return null;
}

export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  title = "Capture photo",
}: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError("");
    setReady(false);

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Caméra non disponible sur cet appareil.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = await waitForVideoElement(() => videoRef.current);
        if (cancelled) return;

        if (!video) {
          setError("Impossible d'afficher la caméra. Réessayez.");
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          return;
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          setError(
            "Impossible d'accéder à la caméra. Autorisez l'accès dans le navigateur.",
          );
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setReady(false);
    };
  }, [open]);

  function capture() {
    const video = videoRef.current;
    if (!video || !ready) {
      toast.error("La caméra n'est pas prête.");
      return;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    if (!width || !height) {
      toast.error("Flux vidéo invalide. Réessayez.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Échec de la capture.");
          return;
        }
        onCapture(
          new File([blob], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
          }),
        );
        onOpenChange(false);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        size="lg"
        className="flex max-h-[min(92dvh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(88dvh,40rem)]"
      >
        <ResponsiveDialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:px-5">
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Cadrez le visage puis appuyez sur Capturer.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
          {error ? (
            <p className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[4/3] max-h-[min(58dvh,28rem)] w-full object-cover sm:aspect-video"
              />
            </div>
          )}

          {!error && !ready ? (
            <p className="text-center text-sm text-muted-foreground">
              Ouverture de la caméra…
            </p>
          ) : null}
        </div>

        <ResponsiveDialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            className="w-full gap-1.5 sm:w-auto"
            disabled={!ready || Boolean(error)}
            onClick={capture}
          >
            <Camera className="size-4" />
            Capturer
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
