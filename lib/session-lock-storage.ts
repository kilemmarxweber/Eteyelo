/** Soft-lock session (idle) — partagé client. Même logique que l’implémentation d’origine. */

export const SESSION_LOCK_STORAGE_KEY = "eteyelo:session-lock";
export const SESSION_LAST_IDENTITY_KEY = "eteyelo:session-last-identity";

/** Inactivité avant verrouillage (système d’origine). */
export const SESSION_IDLE_MS = 15 * 60 * 1000;

/** Event pour forcer l’ouverture du popup depuis un autre composant. */
export const SESSION_LOCK_OPEN_EVENT = "eteyelo:session-lock-open";

export type SessionLockSnapshot = {
  email: string;
  organizationId: string | null;
  branchId: string | null;
};

export function readSessionLockSnapshot(): SessionLockSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionLockSnapshot;
    if (!parsed?.email?.trim()) return null;
    return {
      email: parsed.email.trim(),
      organizationId: parsed.organizationId ?? null,
      branchId: parsed.branchId ?? null,
    };
  } catch {
    return null;
  }
}

export function readLastSessionIdentity(): SessionLockSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_LAST_IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionLockSnapshot;
    if (!parsed?.email?.trim()) return null;
    return {
      email: parsed.email.trim(),
      organizationId: parsed.organizationId ?? null,
      branchId: parsed.branchId ?? null,
    };
  } catch {
    return null;
  }
}

export function rememberSessionIdentity(snapshot: SessionLockSnapshot) {
  if (typeof window === "undefined") return;
  if (!snapshot.email?.trim()) return;
  sessionStorage.setItem(
    SESSION_LAST_IDENTITY_KEY,
    JSON.stringify({
      email: snapshot.email.trim(),
      organizationId: snapshot.organizationId ?? null,
      branchId: snapshot.branchId ?? null,
    }),
  );
}

export function writeSessionLockSnapshot(snapshot: SessionLockSnapshot) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_LOCK_STORAGE_KEY, JSON.stringify(snapshot));
  rememberSessionIdentity(snapshot);
}

export function clearSessionLockSnapshot() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_LOCK_STORAGE_KEY);
}

export function parseAdminContextFromPath(pathname: string): {
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

/**
 * Ouvre le soft-lock (popup) au lieu de rediriger vers /auth/sign-in.
 * Retourne false si aucun email connu → le caller peut alors rediriger.
 */
export function requestSessionLock(partial?: {
  email?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
}): boolean {
  if (typeof window === "undefined") return false;

  const existing = readSessionLockSnapshot();
  const last = readLastSessionIdentity();
  const fromPath = parseAdminContextFromPath(window.location.pathname);
  const email = (
    partial?.email ??
    existing?.email ??
    last?.email ??
    ""
  ).trim();
  if (!email) return false;

  const snapshot: SessionLockSnapshot = {
    email,
    organizationId:
      partial?.organizationId ??
      existing?.organizationId ??
      last?.organizationId ??
      fromPath.organizationId,
    branchId:
      partial?.branchId ??
      existing?.branchId ??
      last?.branchId ??
      fromPath.branchId,
  };

  writeSessionLockSnapshot(snapshot);
  window.dispatchEvent(
    new CustomEvent(SESSION_LOCK_OPEN_EVENT, { detail: snapshot }),
  );
  return true;
}
