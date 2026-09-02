"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Clock, KeyRound, X } from "lucide-react";
import { getMyActiveTemporaryGrantsAction } from "@/app/admin/organizations/[organizationId]/settings/temporary-grants/actions";

type TemporaryGrantItem = {
  id: string;
  resource: string;
  action: string;
  reason: string;
  expiresAt: Date | string;
};

export function TemporaryPrivilegeBanner({ organizationId }: { organizationId?: string }) {
  const [grants, setGrants] = useState<TemporaryGrantItem[]>([]);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    async function loadActiveGrants() {
      const res = await getMyActiveTemporaryGrantsAction(organizationId);
      if (!isMounted) return;
      if (res.ok) {
        setGrants(res.grants);
      }
    }

    loadActiveGrants();

    const interval = setInterval(loadActiveGrants, 10000); // rafraîchir toutes les 10s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [organizationId]);

  useEffect(() => {
    if (grants.length === 0) return;

    const earliestExpire = new Date(grants[0].expiresAt).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = earliestExpire - now;

      if (diff <= 0) {
        setTimeLeft("Expiré");
        setGrants([]);
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
          Accès accordé à <strong className="font-mono">{primaryGrant.resource}:{primaryGrant.action}</strong> ({primaryGrant.reason})
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
