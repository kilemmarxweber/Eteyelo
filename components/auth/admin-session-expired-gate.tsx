"use client";

import { SessionLock } from "@/components/auth/session-lock";
import {
  readLastSessionIdentity,
  readSessionLockSnapshot,
  requestSessionLock,
} from "@/lib/session-lock-storage";
import { useEffect, useState } from "react";

/**
 * Affiché par le layout admin quand le cookie session a disparu :
 * popup soft-lock au lieu d’un redirect hard vers /auth/sign-in.
 */
export function AdminSessionExpiredGate() {
  const [canLock, setCanLock] = useState<boolean | null>(null);

  useEffect(() => {
    const existing =
      readSessionLockSnapshot() ?? readLastSessionIdentity();
    if (existing?.email) {
      requestSessionLock(existing);
      setCanLock(true);
      return;
    }

    // Pas d’identité connue → vraie déconnexion.
    setCanLock(false);
    window.location.assign("/auth/sign-in");
  }, []);

  if (canLock === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Redirection vers la connexion…
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-background">
      <SessionLock forceLocked />
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Session expirée — saisissez votre mot de passe pour continuer.
      </div>
    </div>
  );
}
