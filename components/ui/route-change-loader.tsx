"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { PageLoader } from "@/components/ui/page-loader";
import {
  ROUTE_LOADER_HIDE_EVENT,
  ROUTE_LOADER_START_EVENT,
} from "@/lib/route-loader";

const IS_PROD = process.env.NODE_ENV === "production";
const SHOW_DELAY_MS = IS_PROD ? 180 : 60;
const FADE_OUT_MS = IS_PROD ? 100 : 70;
const MAX_VISIBLE_MS = 8_000;

function RouteChangeLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const fadeTimer = useRef<number | null>(null);
  const routeKey = `${pathname}?${searchParams.toString()}`;

  function clearTimers() {
    if (showTimer.current != null) window.clearTimeout(showTimer.current);
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    if (fadeTimer.current != null) window.clearTimeout(fadeTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
    fadeTimer.current = null;
  }

  function hide() {
    if (showTimer.current != null) window.clearTimeout(showTimer.current);
    showTimer.current = null;
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setPhase((current) => {
      if (current === "hidden") return current;
      if (fadeTimer.current != null) window.clearTimeout(fadeTimer.current);
      fadeTimer.current = window.setTimeout(() => {
        setPhase("hidden");
      }, FADE_OUT_MS);
      return "out";
    });
  }

  function start() {
    clearTimers();
    showTimer.current = window.setTimeout(() => {
      setPhase("in");
      hideTimer.current = window.setTimeout(() => {
        hide();
      }, MAX_VISIBLE_MS);
    }, SHOW_DELAY_MS);
  }

  useEffect(() => {
    // La nouvelle route est commitée : on coupe tout de suite.
    // Les fetchs de la page (session, listes) ne doivent plus retenir l’overlay.
    hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- routeKey is the signal
  }, [routeKey]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.noLoader === "true") return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      start();
    };

    const onPopState = () => start();
    const onProgrammaticStart = () => start();
    const onProgrammaticHide = () => hide();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener(ROUTE_LOADER_START_EVENT, onProgrammaticStart);
    window.addEventListener(ROUTE_LOADER_HIDE_EVENT, onProgrammaticHide);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener(ROUTE_LOADER_START_EVENT, onProgrammaticStart);
      window.removeEventListener(ROUTE_LOADER_HIDE_EVENT, onProgrammaticHide);
      clearTimers();
    };
  }, []);

  const isTvScreen =
    pathname.startsWith("/tv") || pathname.startsWith("/kiosk");

  if (phase === "hidden") return null;

  return (
    <div
      className={
        isTvScreen
          ? `fixed inset-0 z-[300] print:hidden ${phase === "out" ? "page-loader-veil-out" : "page-loader-veil"}`
          : `fixed inset-0 z-[300] bg-background/45 backdrop-blur-[3px] print:hidden ${
              phase === "out" ? "page-loader-veil-out" : "page-loader-veil"
            }`
      }
    >
      <PageLoader
        tone={isTvScreen ? "tv" : "app"}
        className="h-full min-h-svh bg-transparent"
      />
    </div>
  );
}

export function RouteChangeLoader() {
  return (
    <Suspense fallback={null}>
      <RouteChangeLoaderInner />
    </Suspense>
  );
}
