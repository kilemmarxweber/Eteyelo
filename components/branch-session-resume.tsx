"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { useRefresh } from "@/src/hooks/RefreshContext";

const SOFT_RESUME_COOLDOWN_MS = 2000;

/**
 * Au retour sur l'onglet / restauration bfcache (fermer sans logout),
 * la session client et le cache RSC Next peuvent rester figés.
 * F5 marchait car il force un nouveau chargement — on le reproduit ici.
 */
export function BranchSessionResume() {
  const router = useRouter();
  const { refresh } = useRefresh();
  const lastSoftResumeAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const softResume = async () => {
      const now = Date.now();
      if (now - lastSoftResumeAt.current < SOFT_RESUME_COOLDOWN_MS) return;
      lastSoftResumeAt.current = now;

      try {
        await authClient.getSession({
          fetchOptions: { cache: "no-store" },
        });
      } catch (error) {
        console.warn("[BranchSessionResume] getSession failed", error);
      }

      if (cancelled) return;
      router.refresh();
    };

    const hardResume = async () => {
      await softResume();
      if (cancelled) return;
      // Remonte les pages client (stats / tables chargées une fois au mount).
      refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void softResume();
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void hardResume();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [refresh, router]);

  return null;
}
