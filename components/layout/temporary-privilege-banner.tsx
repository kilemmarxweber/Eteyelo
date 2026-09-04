"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, KeyRound, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  getMyActiveTemporaryGrantsAction,
  shouldLeavePageAfterGrantExpiryAction,
} from "@/lib/auth/temporary-grants.action";
import { writeActionIncludesRead } from "@/lib/auth/temporary-grant-actions";

type TemporaryGrantItem = {
  id: string;
  resource: string;
  action: string;
  reason: string;
  expiresAt: Date | string;
};

const SESSION_ENDED_MESSAGE = "Votre session a pris fin.";

function dropExpiredGrants(items: TemporaryGrantItem[]) {
  const now = Date.now();
  return items.filter((grant) => new Date(grant.expiresAt).getTime() > now);
}

export function TemporaryPrivilegeBanner({ organizationId }: { organizationId?: string }) {
  const router = useRouter();
  const [grants, setGrants] = useState<TemporaryGrantItem[]>([]);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const previousGrantIdsRef = useRef<Set<string>>(new Set());
  const grantsHydratedRef = useRef(false);
  const redirectingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    grantsHydratedRef.current = false;
    redirectingRef.current = false;
    previousGrantIdsRef.current = new Set();
    setGrants([]);

    async function loadActiveGrants() {
      const res = await getMyActiveTemporaryGrantsAction(organizationId);
      if (!isMounted) return;
      if (res.ok) {
        grantsHydratedRef.current = true;
        setGrants(dropExpiredGrants(res.grants));
      }
    }

    loadActiveGrants();

    const interval = setInterval(loadActiveGrants, 10000);
    const onFocus = () => {
      void loadActiveGrants();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [organizationId]);

  useEffect(() => {
    if (grants.length === 0) return;

    const earliestExpire = new Date(grants[0].expiresAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = earliestExpire - now;

      if (diff <= 0) {
        setTimeLeft("Expiré");
        setGrants((current) => dropExpiredGrants(current));
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const hours = Math.floor(minutes / 60);
      const remMinutes = minutes % 60;

      if (hours > 0) {
        setTimeLeft(`${hours}h ${remMinutes}m`);
      } else {
        setTimeLeft(`${remMinutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [grants]);

  useEffect(() => {
    const currentIds = new Set(grants.map((grant) => grant.id));

    if (!grantsHydratedRef.current) {
      previousGrantIdsRef.current = currentIds;
      return;
    }

    const previousIds = previousGrantIdsRef.current;
    previousGrantIdsRef.current = currentIds;

    const lostGrant = [...previousIds].some((id) => !currentIds.has(id));
    if (!lostGrant || redirectingRef.current) return;

    const allGrantsGone = currentIds.size === 0;

    const notifyAndMaybeRedirect = async () => {
      const pathname =
        typeof window !== "undefined" ? window.location.pathname : "";

      try {
        const result = await shouldLeavePageAfterGrantExpiryAction(pathname);
        if (!result.leave) {
          if (allGrantsGone) toast.warning(SESSION_ENDED_MESSAGE);
          return;
        }

        redirectingRef.current = true;
        toast.warning(SESSION_ENDED_MESSAGE);
        if (result.dashboardHref) {
          router.replace(result.dashboardHref);
        }
      } catch {
        if (allGrantsGone) toast.warning(SESSION_ENDED_MESSAGE);
      }
    };

    void notifyAndMaybeRedirect();
  }, [grants, router]);

  if (grants.length === 0 || dismissed) {
    return null;
  }

  const primaryGrant = grants[0];

  return (
    <div className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs sm:text-sm flex items-center justify-between shadow-xs transition-all">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30">
          <KeyRound className="h-3.5 w-3.5" /> Privilège Temporaire Actif
        </span>
        <span>
          Accès accordé à{" "}
          <strong className="font-mono">
            {primaryGrant.resource}:{primaryGrant.action}
            {writeActionIncludesRead(primaryGrant.action)
              ? " + lecture"
              : ""}
          </strong>{" "}
          ({primaryGrant.reason})
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1 font-mono font-medium text-amber-800 dark:text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">
          <Clock className="h-3.5 w-3.5 animate-pulse" />
          <span>{timeLeft}</span>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white p-0.5 rounded transition-colors"
          title="Masquer le bandeau"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
