"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { restoreSessionLockContextAction } from "@/app/admin/session-lock/restore-context.action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import {
  SESSION_LOCK_OPEN_EVENT,
  clearSessionLockSnapshot,
  isSessionIdleExpired,
  markSessionActivity,
  parseAdminContextFromPath,
  readLastSessionActivity,
  readLastSessionIdentity,
  readSessionLockSnapshot,
  rememberSessionIdentity,
  SESSION_IDLE_MS,
  writeSessionLockSnapshot,
  type SessionLockSnapshot,
} from "@/lib/session-lock-storage";

function isIdleSkipPath(pathname: string) {
  return (
    pathname.startsWith("/kiosk") ||
    pathname.startsWith("/tv") ||
    pathname.startsWith("/attendance") ||
    pathname.startsWith("/auth")
  );
}

type SessionLockProps = {
  /** Forcer le popup (ex. layout admin sans session serveur). */
  forceLocked?: boolean;
};

export function SessionLock({ forceLocked = false }: SessionLockProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const skipIdle = isIdleSkipPath(pathname);
  const { data: session, isPending } = useSession();
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [snapshot, setSnapshot] = useState<SessionLockSnapshot | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPendingUnlock, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);
  const lastIdentityRef = useRef<SessionLockSnapshot | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  // Mémorise la dernière identité connue tant que la session est valide.
  useEffect(() => {
    const email = session?.user?.email?.trim();
    if (!email) return;
    const fromPath = parseAdminContextFromPath(pathname);
    const identity: SessionLockSnapshot = {
      email,
      organizationId:
        fromPath.organizationId ??
        session.session?.activeOrganizationId ??
        session.organization?.id ??
        null,
      branchId:
        fromPath.branchId ??
        session.session?.activeBranchId ??
        session.branch?.id ??
        null,
    };
    lastIdentityRef.current = identity;
    rememberSessionIdentity(identity);
  }, [session, pathname]);

  function applyLock(next: SessionLockSnapshot) {
    writeSessionLockSnapshot(next);
    lockedRef.current = true;
    setSnapshot(next);
    setPassword("");
    setError(null);
    setLocked(true);
  }

  useEffect(() => {
    if (!skipIdle) {
      const existing = readSessionLockSnapshot();
      if (forceLocked || (existing && isSessionIdleExpired())) {
        const next =
          existing ??
          lastIdentityRef.current ??
          ({
            email: "",
            organizationId: parseAdminContextFromPath(pathname).organizationId,
            branchId: parseAdminContextFromPath(pathname).branchId,
          } satisfies SessionLockSnapshot);
        if (next.email) {
          lockedRef.current = true;
          setSnapshot(next);
          setPassword("");
          setError(null);
          setLocked(true);
        }
      } else {
        clearSessionLockSnapshot();
        markSessionActivity();
      }
    }
    setReady(true);
  }, [skipIdle, forceLocked, pathname]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      if (skipIdle) return;
      const detail = (event as CustomEvent<SessionLockSnapshot>).detail;
      const next = detail?.email ? detail : readSessionLockSnapshot();
      if (!next?.email) return;
      applyLock(next);
    };
    window.addEventListener(SESSION_LOCK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SESSION_LOCK_OPEN_EVENT, onOpen);
  }, [skipIdle]);

  useEffect(() => {
    if (!locked || skipIdle) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [locked, skipIdle]);

  // Idle → soft-lock. Le délai repart seulement sur une action réelle,
  // pas quand la session est simplement relue.
  useEffect(() => {
    const email = session?.user?.email;
    if (!ready || !email || locked || skipIdle) return;

    const arm = () => {
      if (lockedRef.current) return;
      if (document.querySelector('[data-idle-logout="off"]')) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const last = readLastSessionActivity();
      const elapsed = last > 0 ? Date.now() - last : 0;
      const wait = Math.max(1000, SESSION_IDLE_MS - elapsed);
      timeoutRef.current = setTimeout(() => {
        if (document.querySelector('[data-idle-logout="off"]')) return;
        if (!isSessionIdleExpired()) {
          arm();
          return;
        }
        const current = sessionRef.current;
        const fromPath = parseAdminContextFromPath(window.location.pathname);
        applyLock({
          email,
          organizationId:
            fromPath.organizationId ??
            current?.session?.activeOrganizationId ??
            current?.organization?.id ??
            null,
          branchId:
            fromPath.branchId ??
            current?.session?.activeBranchId ??
            current?.branch?.id ??
            null,
        });
      }, wait);
    };

    let lastMark = 0;
    const onActivity = () => {
      if (lockedRef.current) return;
      const now = Date.now();
      if (now - lastMark < 1000) return;
      lastMark = now;
      markSessionActivity();
      arm();
    };

    const events = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ] as const;

    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    arm();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      for (const event of events) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [session?.user?.email, locked, ready, skipIdle]);

  // Un refetch qui vide brièvement la session ne verrouille pas.
  // Le popup n’apparaît qu’après 30 minutes sans action.
  useEffect(() => {
    if (!ready || skipIdle || locked || isPending) return;
    if (session) return;
    if (!isSessionIdleExpired()) return;

    const next =
      readSessionLockSnapshot() ??
      lastIdentityRef.current ??
      readLastSessionIdentity();
    if (!next?.email) return;
    applyLock(next);
  }, [ready, skipIdle, locked, isPending, session]);

  function unlock() {
    clearSessionLockSnapshot();
    lockedRef.current = false;
    setLocked(false);
    setSnapshot(null);
    setPassword("");
    setError(null);
  }

  function handleUnlockSubmit(event: FormEvent) {
    event.preventDefault();
    if (!snapshot?.email || !password.trim()) {
      setError("Saisissez votre mot de passe.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const { error: signInError } = await authClient.signIn.email({
        email: snapshot.email,
        password,
      });

      if (signInError) {
        setError(
          signInError.message ??
            "Mot de passe incorrect. Vérifiez et réessayez.",
        );
        return;
      }

      const restored = await restoreSessionLockContextAction({
        organizationId: snapshot.organizationId,
        branchId: snapshot.branchId,
      });

      if (!restored.ok) {
        setError(restored.message);
        return;
      }

      await authClient.getSession();
      unlock();
      router.refresh();
    });
  }

  async function handleSignOut() {
    clearSessionLockSnapshot();
    try {
      await authClient.signOut();
    } catch {
      // redirect anyway
    }
    window.location.href = "/auth/sign-in";
  }

  if (!ready || skipIdle || !locked) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-3 backdrop-blur-[2px] sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-lock-title"
        aria-describedby="session-lock-desc"
        className="w-[min(calc(100vw-1.5rem),40rem)] overflow-hidden rounded-xl border border-border/70 bg-popover text-popover-foreground shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LockKeyhole className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="session-lock-title"
              className="text-base font-semibold tracking-tight sm:text-lg"
            >
              Session verrouillée
            </h2>
            <p
              id="session-lock-desc"
              className="text-sm leading-snug text-muted-foreground"
            >
              Mot de passe pour continuer sur cette page.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleUnlockSubmit}
          className="space-y-4 px-5 py-5 sm:px-6"
        >
          {snapshot?.email ? (
            <p className="truncate text-xs font-medium text-muted-foreground">
              {snapshot.email}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="session-lock-password">Mot de passe</Label>
            <Input
              id="session-lock-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isPendingUnlock}
              className="h-11"
              placeholder="Votre mot de passe"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-2 pt-1 min-[400px]:grid-cols-2">
            <Button
              type="button"
              className="h-11 rounded-md bg-red-600 text-white hover:bg-red-700"
              disabled={isPendingUnlock}
              onClick={() => void handleSignOut()}
            >
              Se déconnecter
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isPendingUnlock || !password.trim()}
            >
              {isPendingUnlock ? "Vérification…" : "Continuer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
