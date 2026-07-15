"use client";

import { useEffect, useRef } from "react";

import { useAppLoading } from "@/hooks/use-app-loading";

export function useSyncAppLoading(active: boolean) {
  const { startLoading, stopLoading } = useAppLoading();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (active && !trackedRef.current) {
      trackedRef.current = true;
      startLoading();
      return;
    }

    if (!active && trackedRef.current) {
      trackedRef.current = false;
      stopLoading();
    }
  }, [active, startLoading, stopLoading]);

  useEffect(() => {
    return () => {
      if (!trackedRef.current) return;
      trackedRef.current = false;
      stopLoading();
    };
  }, [stopLoading]);
}
