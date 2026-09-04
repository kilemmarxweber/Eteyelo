"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, KeyRound, X } from "lucide-react";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

import { useAppRouter } from "@/hooks/use-app-router";
import {
  getMyActiveTemporaryGrantsAction,
  shouldLeavePageAfterGrantExpiryAction,
} from "@/lib/auth/temporary-grants.action";
import { writeActionIncludesRead } from "@/lib/auth/temporary-grant-actions";
import {
  isGrantedWorkspacePage,
  parseBranchWorkspacePath,
} from "@/lib/auth/temporary-privilege-session";

type TemporaryGrantItem = {
  id: string;
  resource: string;
  action: string;
  reason: string;
  expiresAt: Date | string;
};

const SESSION_ENDED_MESSAGE = "Votre session a pris fin.";
const POLL_MS_WITH_GRANTS = 3000;
const POLL_MS_IDLE = 10000;

function dropExpiredGrants(items: TemporaryGrantItem[]) {
  const now = Date.now();
  return items.filter((grant) => new Date(grant.expiresAt).getTime() > now);
}

function sameGrantList(
  current: TemporaryGrantItem[],
  next: TemporaryGrantItem[],
) {
  if (current.length !== next.length) return false;
  return current.every((grant, index) => grant.id === next[index]?.id);
}

export function TemporaryPrivilegeBanner({ organizationId }: { organizationId?: string }) {
  const router = useAppRouter();
  const pathname = usePathname();
  const parsedPath = parseBranchWorkspacePath(pathname);
  const branchId = parsedPath?.branchId ?? null;
  const [grants, setGrants] = useState<TemporaryGrantItem[]>([]);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const previousGrantIdsRef = useRef<Set<string>>(new Set());
  const grantsHydratedRef = useRef(false);
  const redirectingRef = useRef(false);
  const pathnameRef = useRef(pathname);

  pathnameRef.current = pathname;

  useEffect(() => {
    let isMounted = true;
    grantsHydratedRef.current = false;
    redirectingRef.current = false;
    previousGrantIdsRef.current = new Set();
    setGrants([]);
    setDismissed(false);

    async function loadActiveGrants() {
      const res = await getMyActiveTemporaryGrantsAction(organizationId, branchId);
      if (!isMounted) return;
      if (res.ok) {
        grantsHydratedRef.current = true;
        const next = dropExpiredGrants(res.grants);
        setGrants((current) => (sameGrantList(current, next) ? current : next));
      }
    }

    void loadActiveGrants();

    const interval = setInterval(loadActiveGrants, POLL_MS_IDLE);
    const onFocus = () => {
      void loadActiveGrants();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadActiveGrants();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [organizationId, branchId]);

  const hasActiveGrants = grants.length > 0;

  useEffect(() => {
    if (!hasActiveGrants) return;

    const interval = setInterval(() => {
      void getMyActiveTemporaryGrantsAction(organizationId, branchId).then(
        (res) => {
          if (!res.ok) return;
          const next = dropExpiredGrants(res.grants);
          setGrants((current) => (sameGrantList(current, next) ? current : next));
        },
      );
    }, POLL_MS_WITH_GRANTS);

    return () => clearInterval(interval);
  }, [hasActiveGrants, organizationId, branchId]);

  useEffect(() => {
    if (grants.length === 0) return;

    const earliestExpire = Math.min(
      ...grants.map((grant) => new Date(grant.expiresAt).getTime()),
    );

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
    const expireTimeout = window.setTimeout(() => {
      setGrants((current) => dropExpiredGrants(current));
    }, Math.max(0, earliestExpire - Date.now()) + 50);

    return () => {
      clearInterval(timerInterval);
      window.clearTimeout(expireTimeout);
    };
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
    const currentPath = pathnameRef.current;
    const parsed = parseBranchWorkspacePath(currentPath);

    const notifyAndMaybeRedirect = async () => {
      const goToDashboard = (dashboardHref: string) => {
        redirectingRef.current = true;
        toast.warning(SESSION_ENDED_MESSAGE);
        router.replace(dashboardHref);
        router.refresh();
      };

      try {
        const result = await shouldLeavePageAfterGrantExpiryAction(currentPath);
        if (result.leave && result.dashboardHref) {
          goToDashboard(result.dashboardHref);
          return;
        }

        if (!result.leave) {
          if (allGrantsGone) toast.warning(SESSION_ENDED_MESSAGE);
          router.refresh();
          return;
        }
      } catch {
        if (parsed?.dashboardHref && isGrantedWorkspacePage(parsed)) {
          goToDashboard(parsed.dashboardHref);
          return;
        }
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
