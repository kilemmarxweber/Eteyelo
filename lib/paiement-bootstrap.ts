const STORAGE_PREFIX = "eteyelo:paiement-bootstrap:";
const TTL_MS = 5 * 60 * 1000;

export type PaiementBootstrap = {
  q: string;
  enrollmentId: string;
  at: number;
};

let memoryBootstrap: (PaiementBootstrap & { branchId: string }) | null = null;

function storageKey(branchId: string) {
  return `${STORAGE_PREFIX}${branchId}`;
}

function isFresh(at: number) {
  return Number.isFinite(at) && Date.now() - at < TTL_MS;
}

export function writePaiementBootstrap(
  branchId: string,
  payload: { q?: string; enrollmentId?: string },
) {
  const next: PaiementBootstrap & { branchId: string } = {
    branchId,
    q: (payload.q ?? "").trim(),
    enrollmentId: (payload.enrollmentId ?? "").trim(),
    at: Date.now(),
  };
  memoryBootstrap = next;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      storageKey(branchId),
      JSON.stringify({
        q: next.q,
        enrollmentId: next.enrollmentId,
        at: next.at,
      }),
    );
  } catch {
    // quota / private mode
  }
}

export function readPaiementBootstrap(branchId: string | undefined): PaiementBootstrap {
  const empty: PaiementBootstrap = { q: "", enrollmentId: "", at: 0 };
  if (!branchId) return empty;

  if (
    memoryBootstrap &&
    memoryBootstrap.branchId === branchId &&
    isFresh(memoryBootstrap.at)
  ) {
    return {
      q: memoryBootstrap.q,
      enrollmentId: memoryBootstrap.enrollmentId,
      at: memoryBootstrap.at,
    };
  }

  if (typeof window === "undefined") return empty;

  try {
    const raw = sessionStorage.getItem(storageKey(branchId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PaiementBootstrap>;
    const at = typeof parsed.at === "number" ? parsed.at : 0;
    if (!isFresh(at)) return empty;
    return {
      q: (parsed.q ?? "").trim(),
      enrollmentId: (parsed.enrollmentId ?? "").trim(),
      at,
    };
  } catch {
    return empty;
  }
}

export function consumePaiementBootstrap(branchId: string | undefined) {
  if (!branchId) return;
  if (memoryBootstrap?.branchId === branchId) {
    memoryBootstrap = null;
  }
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(branchId));
  } catch {
    // ignore
  }
}
