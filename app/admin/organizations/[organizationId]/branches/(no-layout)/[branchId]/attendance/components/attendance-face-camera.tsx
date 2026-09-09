"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { IconCamera, IconCameraRotate } from "@tabler/icons-react";
import {
  averageDescriptors,
  detectFaceDescriptor,
  isStableFaceSample,
  loadFaceApi,
  openAttendanceCameraStream,
  type AttendanceCameraFacing,
} from "@/lib/face-recognition.client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FaceCameraStatus = "loading" | "ready" | "detecting" | "error";

const FACING_STORAGE_KEY = "eteyelo-attendance-face-facing";

function readStoredFacing(): AttendanceCameraFacing {
  if (typeof window === "undefined") return "user";
  try {
    const stored = window.localStorage.getItem(FACING_STORAGE_KEY);
    if (stored === "user" || stored === "environment") return stored;
  } catch {
    /* ignore */
  }
  return "user";
}

export function AttendanceFaceCamera({
  onDescriptor,
  paused = false,
  statusLabel,
}: {
  onDescriptor: (descriptor: number[]) => void;
  paused?: boolean;
  statusLabel?: string;
}) {
  const t = useTranslations("attendance.checkInUi");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<number[][]>([]);
  const onDescriptorRef = useRef(onDescriptor);
  const pausedRef = useRef(paused);
  const [facing, setFacing] = useState<AttendanceCameraFacing>(readStoredFacing);
  const [status, setStatus] = useState<FaceCameraStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  onDescriptorRef.current = onDescriptor;
  pausedRef.current = paused;

  useEffect(() => {
    try {
      window.localStorage.setItem(FACING_STORAGE_KEY, facing);
    } catch {
      /* ignore */
    }
  }, [facing]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function start() {
      setStatus("loading");
      setError(null);
      samplesRef.current = [];

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 220);
      });

      try {
        const stream = await openAttendanceCameraStream(facing);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setError(t("cameraUnavailable"));
          setStatus("error");
        }
        return;
      }

      try {
        await loadFaceApi();
        if (cancelled) return;
      } catch {
        if (!cancelled) {
          setError(t("faceModelUnavailable"));
        }
        return;
      }

      const tick = async () => {
        if (cancelled) return;
        if (pausedRef.current) {
          timer = window.setTimeout(() => void tick(), 280);
          return;
        }
        const videoEl = videoRef.current;
        if (!videoEl || videoEl.readyState < 2) {
          timer = window.setTimeout(() => void tick(), 280);
          return;
        }
        try {
          const descriptor = await detectFaceDescriptor(videoEl);
          if (cancelled) return;
          if (descriptor) {
            setStatus("detecting");
            const samples = [...samplesRef.current, descriptor].slice(-5);
            samplesRef.current = samples;
            if (isStableFaceSample(samples)) {
              const averaged = averageDescriptors(samples.slice(-3));
              samplesRef.current = [];
              onDescriptorRef.current(averaged);
              timer = window.setTimeout(() => void tick(), 1800);
              return;
            }
          } else {
            samplesRef.current = [];
            setStatus("ready");
          }
        } catch {
          setStatus("ready");
        }
        timer = window.setTimeout(() => void tick(), 280);
      };

      void tick();
    }

    void start();

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [facing, t]);

  const hint =
    statusLabel ??
    (status === "loading"
      ? t("openingCamera")
      : status === "detecting"
        ? t("holdStill")
        : status === "error"
          ? t("cameraUnavailableShort")
          : t("lookAtCamera"));

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border bg-black">
        <video
          ref={videoRef}
          className={cn(
            "aspect-[4/3] max-h-[min(52dvh,22rem)] w-full object-cover",
            facing === "user" && "-scale-x-100",
          )}
          muted
          autoPlay
          playsInline
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-32 rounded-full border-2 border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
        </div>
        {status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-sm text-white">
            <IconCamera className="size-8 opacity-80" />
            {t("openingCamera")}
          </div>
        ) : null}
        <div className="absolute right-2 top-2 z-10">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 gap-1.5 rounded-full bg-black/55 px-3 text-white hover:bg-black/75"
            onClick={() =>
              setFacing((current) =>
                current === "user" ? "environment" : "user",
              )
            }
            aria-label={t("switchCamera")}
          >
            <IconCameraRotate className="size-4" />
            {facing === "user" ? t("cameraFront") : t("cameraRear")}
          </Button>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs font-medium text-white/95">
          {hint}
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
