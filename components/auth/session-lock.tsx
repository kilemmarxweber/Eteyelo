"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { restoreSessionLockContextAction } from "@/app/admin/session-lock/restore-context.action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const INACTIVE_MS = 15 * 60 * 1000;
const LOCK_STORAGE_KEY = "eteyelo:session-lock";

type LockSnapshot = {
  email: string;
  organizationId: string | null;
  branchId: string | null;
};

function parseAdminContext(pathname: string): {
  organizationId: string | null;
  branchId: string | null;
} {
  const orgMatch = pathname.match(/^\/admin\/organizations\/([^/]+)/);
  const branchMatch = pathname.match(
    /^\/admin\/organizations\/[^/]+\/branches\/([^/]+)/,
  );
  const rawBranchId = branchMatch?.[1] ?? null;
  const branchId =
    rawBranchId && !["new", "edit", "enter"].includes(rawBranchId)
      ? rawBranchId
      : null;

  return {
    organizationId: orgMatch?.[1] ?? null,
    branchId,
  };
}

function readLockSnapshot(): LockSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockSnapshot;
    if (!parsed?.email) return null;
    return {
      email: parsed.email,
      organizationId: parsed.organizationId ?? null,
      branchId: parsed.branchId ?? null,
    };
  } catch {
    return null;
  }
}

function writeLockSnapshot(snapshot: LockSnapshot) {
  sessionStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(snapshot));
}

function clearLockSnapshot() {
  sessionStorage.removeItem(LOCK_STORAGE_KEY);
}

export function SessionLock() {
  const { data: session } = useSession();
  const [locked, setLocked] = useState(() => !!readLockSnapshot());
  const [snapshot, setSnapshot] = useState<LockSnapshot | null>(() =>
    readLockSnapshot(),
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(locked);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    const email = session?.user?.email;
    if (!email || locked) return;

    const resetTimer = () => {
      if (lockedRef.current) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        const fromPath = parseAdminContext(window.location.pathname);
        const nextSnapshot: LockSnapshot = {
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
        writeLockSnapshot(nextSnapshot);
        lockedRef.current = true;
        setSnapshot(nextSnapshot);
        setPassword("");
        setError(null);
        setLocked(true);
      }, INACTIVE_MS);
    };

    const events = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ] as const;

    for (const event of events) {
      window.addEventListener(event, resetTimer, { passive: true });
    }
    resetTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      for (const event of events) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [session, locked]);

  function unlock() {
    clearLockSnapshot();
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
    });
  }

  async function handleSignOut() {
    clearLockSnapshot();
    try {
      await authClient.signOut();
    } catch {
      // redirect anyway
    }
    window.location.href = "/auth/sign-in";
  }

  return (
    <DialogPrimitive.Root open={locked}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[200] bg-black/70",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[200] w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border bg-background p-6 shadow-lg outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]",
          )}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Title className="text-lg font-semibold tracking-tight">
            Session verrouillée
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
            Inactivité détectée. Saisissez votre mot de passe pour continuer
            sur cette page.
          </DialogPrimitive.Description>

          {snapshot?.email ? (
            <p className="mt-4 truncate text-sm font-medium text-foreground">
              {snapshot.email}
            </p>
          ) : null}

          <form onSubmit={handleUnlockSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-lock-password">Mot de passe</Label>
              <Input
                id="session-lock-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isPending}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={() => void handleSignOut()}
              >
                Se déconnecter
              </Button>
              <Button type="submit" disabled={isPending || !password.trim()}>
                {isPending ? "Vérification…" : "Continuer"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
