"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

const SESSION_REFRESH_COOLDOWN_MS = 30_000;

/**
 * Au retour sur l'onglet / restauration bfcache, rafraîchit la session client.
 * Ne remonte plus toute la branche (pas de router.refresh / refreshKey) sauf bfcache.
 */
export function BranchSessionResume() {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const refreshSessionOnly = async () => {
      const now = Date.now();
      if (now - lastRefreshAt.current < SESSION_REFRESH_COOLDOWN_MS) return;
      lastRefreshAt.current = now;

      try {
        await authClient.getSession({
          fetchOptions: { cache: "no-store" },
        });
      } catch (error) {
        console.warn("[BranchSessionResume] getSession failed", error);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshSessionOnly();
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      // bfcache uniquement : vrai besoin de resync RSC.
      if (!event.persisted || cancelled) return;
      void (async () => {
        await refreshSessionOnly();
        if (!cancelled) router.refresh();
      })();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
