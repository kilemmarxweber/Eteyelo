"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera } from "@tabler/icons-react";
import {
  averageDescriptors,
  detectFaceDescriptor,
  isStableFaceSample,
  loadFaceApi,
  openAttendanceCameraStream,
} from "@/lib/face-recognition.client";

type FaceCameraStatus = "loading" | "ready" | "detecting" | "error";

export function AttendanceFaceCamera({
  onDescriptor,
  paused = false,
  statusLabel,
}: {
  onDescriptor: (descriptor: number[]) => void;
  paused?: boolean;
  statusLabel?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<number[][]>([]);
  const onDescriptorRef = useRef(onDescriptor);
  const pausedRef = useRef(paused);
  const [status, setStatus] = useState<FaceCameraStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  onDescriptorRef.current = onDescriptor;
  pausedRef.current = paused;

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
        const stream = await openAttendanceCameraStream();
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
          setError(
            "Camera indisponible. Autorisez la camera ou utilisez la carte.",
          );
          setStatus("error");
        }
        return;
      }

      try {
        await loadFaceApi();
        if (cancelled) return;
      } catch {
        if (!cancelled) {
          setError(
            "Modele facial indisponible. Verifiez la connexion, puis reessayez.",
          );
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
  }, []);

  const hint =
    statusLabel ??
    (status === "loading"
      ? "Ouverture de la camera…"
      : status === "detecting"
        ? "Restez immobile…"
        : status === "error"
          ? "Camera indisponible"
          : "Regardez la camera, visage bien eclaire.");

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border bg-black">
        <video
          ref={videoRef}
          className="aspect-[4/3] max-h-[min(52dvh,22rem)] w-full object-cover"
          muted
          autoPlay
          playsInline
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-32 rounded-full border-2 border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
        </div>
        {status === "loading" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-sm text-white">
            <IconCamera className="size-8 opacity-80" />
            Ouverture de la camera…
          </div>
        ) : null}
        <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs font-medium text-white/95">
          {hint}
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
