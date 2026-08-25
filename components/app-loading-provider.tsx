"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { RouteChangeLoader } from "@/components/ui/route-change-loader";
import { startRouteLoader } from "@/lib/route-loader";

type AppLoadingContextValue = {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  startNavigationLoading: () => void;
  resetLoading: () => void;
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>;
};

const noop = () => {};

const FALLBACK_APP_LOADING: AppLoadingContextValue = {
  isLoading: false,
  startLoading: noop,
  stopLoading: noop,
  startNavigationLoading: noop,
  resetLoading: noop,
  withLoading: async (fn) => fn(),
};

const AppLoadingContext =
  createContext<AppLoadingContextValue>(FALLBACK_APP_LOADING);
const MAX_LOADER_MS = 12_000;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function resolveRequestMethod(
  init?: RequestInit,
  input?: RequestInfo | URL,
): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function resolveRequestPathname(input: RequestInfo | URL): string | null {
  try {
    return new URL(resolveRequestUrl(input), window.location.origin).pathname;
  } catch {
    return null;
  }
}

function readHeaders(init?: RequestInit, input?: RequestInfo | URL) {
  const headers = new Headers(init?.headers);

  if (input instanceof Request) {
    input.headers.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function shouldTrackFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = readHeaders(init, input);

  if (headers.has("Next-Action") || headers.has("next-action")) {
    return true;
  }

  const method = resolveRequestMethod(init, input);
  if (!MUTATING_METHODS.has(method)) return false;

  const pathname = resolveRequestPathname(input);
  if (!pathname) return false;

  return pathname.startsWith("/api/") || pathname.startsWith("/apis/");
}

export function AppLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);
  const pendingCountRef = useRef(0);
  const navigationCountRef = useRef(0);
  const flushScheduledRef = useRef(false);
  const safetyTimerRef = useRef<number | null>(null);

  const flushPendingCount = useCallback(() => {
    if (flushScheduledRef.current) return;

    flushScheduledRef.current = true;

    queueMicrotask(() => {
      flushScheduledRef.current = false;
      const next = pendingCountRef.current;

      startTransition(() => {
        setPendingCount(next);
      });
    });
  }, []);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const scheduleSafetyReset = useCallback(() => {
    clearSafetyTimer();

    if (pendingCountRef.current <= 0) return;

    safetyTimerRef.current = window.setTimeout(() => {
      pendingCountRef.current = 0;
      navigationCountRef.current = 0;
      flushPendingCount();
      safetyTimerRef.current = null;
    }, MAX_LOADER_MS);
  }, [clearSafetyTimer, flushPendingCount]);

  const resetLoading = useCallback(() => {
    pendingCountRef.current = 0;
    navigationCountRef.current = 0;
    clearSafetyTimer();
    flushPendingCount();
  }, [clearSafetyTimer, flushPendingCount]);

  const startLoading = useCallback(() => {
    pendingCountRef.current += 1;
    flushPendingCount();
    scheduleSafetyReset();
    // Pas de RouteChangeLoader ici : réservé à la navigation réelle.
    // Sinon chaque server action fait « recharger » la page.
  }, [flushPendingCount, scheduleSafetyReset]);

  const stopLoading = useCallback(() => {
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
    flushPendingCount();

    if (pendingCountRef.current <= 0) {
      clearSafetyTimer();
    }
  }, [clearSafetyTimer, flushPendingCount]);

  const startNavigationLoading = useCallback(() => {
    navigationCountRef.current += 1;
    startRouteLoader();
    pendingCountRef.current += 1;
    flushPendingCount();
    scheduleSafetyReset();
  }, [flushPendingCount, scheduleSafetyReset]);

  const finishNavigation = useCallback(() => {
    if (navigationCountRef.current <= 0) return;

    pendingCountRef.current = Math.max(
      0,
      pendingCountRef.current - navigationCountRef.current,
    );
    navigationCountRef.current = 0;
    flushPendingCount();

    if (pendingCountRef.current <= 0) {
      clearSafetyTimer();
    }
  }, [clearSafetyTimer, flushPendingCount]);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>) => {
      startLoading();
      try {
        return await fn();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading],
  );

  useEffect(() => {
    finishNavigation();
  }, [pathname, finishNavigation]);

  useEffect(() => {
    const resetOnLeave = () => resetLoading();
    window.addEventListener("pagehide", resetOnLeave);
    return () => window.removeEventListener("pagehide", resetOnLeave);
  }, [resetLoading]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const shouldTrack = shouldTrackFetch(input, init);

      if (shouldTrack) startLoading();

      try {
        return await originalFetch(input, init);
      } finally {
        if (shouldTrack) stopLoading();
      }
    };

    return () => {
      window.fetch = originalFetch;
      clearSafetyTimer();
    };
  }, [startLoading, stopLoading, clearSafetyTimer]);

  const value = useMemo(
    () => ({
      isLoading: pendingCount > 0,
      startLoading,
      stopLoading,
      startNavigationLoading,
      resetLoading,
      withLoading,
    }),
    [
      pendingCount,
      startLoading,
      stopLoading,
      startNavigationLoading,
      resetLoading,
      withLoading,
    ],
  );

  return (
    <AppLoadingContext.Provider value={value}>
      <RouteChangeLoader />
      {children}
    </AppLoadingContext.Provider>
  );
}

export function useAppLoading() {
  return useContext(AppLoadingContext);
}
