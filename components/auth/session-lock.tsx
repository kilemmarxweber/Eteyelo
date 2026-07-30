"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LockKeyhole } from "lucide-react";

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
  // Defer all lock UI until after mount so Radix never injects aria-hidden
  // during SSR / hydration (mismatch on Sidebar, header, MobileNav).
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [snapshot, setSnapshot] = useState<LockSnapshot | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    const existing = readLockSnapshot();
    if (existing) {
      lockedRef.current = true;
      setSnapshot(existing);
      setPassword("");
      setError(null);
      setLocked(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!locked) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [locked]);

  useEffect(() => {
    const email = session?.user?.email;
    if (!ready || !email || locked) return;

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
  }, [session, locked, ready]);

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

  if (!ready) return null;

  return (
    <DialogPrimitive.Root open={locked} modal>
      <DialogPrimitive.Portal>
        {/* Couche opaque : bloque clics + assombrit / floute toute la page */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[200]",
            "bg-black/40 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[201] w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]",
          )}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="border-b border-border/70 bg-muted/30 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-sm">
                <LockKeyhole className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <DialogPrimitive.Title className="text-base font-semibold tracking-tight">
                  Session verrouillée
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm leading-snug text-muted-foreground">
                  Inactivité détectée. Saisissez votre mot de passe pour
                  continuer sur cette page.
                </DialogPrimitive.Description>
              </div>
            </div>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-4 px-5 py-4">
            {snapshot?.email ? (
              <p className="truncate rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-xs font-medium text-foreground">
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
                disabled={isPending}
                className="h-10"
              />
            </div>

            {error ? (
              <p
                className="rounded-md border border-destructive/25 bg-destructive/5 px-2.5 py-1.5 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "h-8 w-auto shrink-0 px-3",
                  "border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-700",
                  "dark:border-red-400/35 dark:text-red-400 dark:hover:bg-red-500/15 dark:hover:text-red-300",
                )}
                disabled={isPending}
                onClick={() => void handleSignOut()}
              >
                Se déconnecter
              </Button>
              <Button
                type="submit"
                size="sm"
                className={cn(
                  "h-8 w-auto shrink-0 px-3.5",
                  "bg-emerald-600 text-white hover:bg-emerald-600/90",
                  "dark:bg-emerald-500 dark:hover:bg-emerald-500/90",
                )}
                disabled={isPending || !password.trim()}
              >
                {isPending ? "Vérification…" : "Continuer"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
