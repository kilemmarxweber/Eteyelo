/**
 * File process-wide pour les alertes école → inbox Klambo.
 *
 * Même idée que WhatsApp (`enqueueWhatsAppTask`) : sérialise les envois
 * et alterne les natures (absence / paiement / résultats…) en round-robin
 * pour éviter une rafale de createConversation + WS sur le process.
 *
 * Pacing léger (DB / realtime), pas anti-ban QR.
 */

import type { WhatsAppQueueKind } from "@/lib/whatsapp-pace";

export type SchoolNotifyQueueKind = WhatsAppQueueKind;

const KIND_ROTATION: SchoolNotifyQueueKind[] = [
  "absence",
  "payment",
  "results",
  "schedule",
  "credentials",
  "finance",
  "mirror",
  "test",
  "other",
];

type QueuedJob = {
  kind: SchoolNotifyQueueKind;
  runTask: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

const lanes = new Map<SchoolNotifyQueueKind, QueuedJob[]>();
let lastServedKind: SchoolNotifyQueueKind | null = null;
let lastRunAt = 0;
let pumpRunning = false;

function readGapMs(): number {
  const raw = process.env.KLAMBO_NOTIFY_GAP_MS;
  if (!raw) return 120;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 120;
  return Math.min(Math.round(n), 5_000);
}

function sleepMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function laneOf(kind: SchoolNotifyQueueKind): QueuedJob[] {
  let lane = lanes.get(kind);
  if (!lane) {
    lane = [];
    lanes.set(kind, lane);
  }
  return lane;
}

function pendingKinds(): SchoolNotifyQueueKind[] {
  return KIND_ROTATION.filter((kind) => (lanes.get(kind)?.length ?? 0) > 0);
}

function pickNextJob(): QueuedJob | null {
  const ready = pendingKinds();
  if (ready.length === 0) return null;

  let start = 0;
  if (lastServedKind) {
    const idx = KIND_ROTATION.indexOf(lastServedKind);
    start = idx >= 0 ? (idx + 1) % KIND_ROTATION.length : 0;
  }

  for (let step = 0; step < KIND_ROTATION.length; step += 1) {
    const kind = KIND_ROTATION[(start + step) % KIND_ROTATION.length]!;
    const lane = lanes.get(kind);
    if (lane && lane.length > 0) {
      return lane.shift() ?? null;
    }
  }
  return null;
}

async function executeJob(job: QueuedJob): Promise<void> {
  const gap = readGapMs();
  if (lastRunAt > 0 && gap > 0) {
    const wait = lastRunAt + gap - Date.now();
    if (wait > 0) await sleepMs(wait);
  }

  try {
    const result = await job.runTask();
    job.resolve(result);
  } catch (error) {
    job.reject(error);
  } finally {
    lastRunAt = Date.now();
    lastServedKind = job.kind;
  }
}

async function pumpSchoolNotifyQueue(): Promise<void> {
  if (pumpRunning) return;
  pumpRunning = true;
  try {
    for (;;) {
      const job = pickNextJob();
      if (!job) break;
      await executeJob(job);
    }
  } finally {
    pumpRunning = false;
    if (pendingKinds().length > 0) {
      void pumpSchoolNotifyQueue();
    }
  }
}

/** Enfile une livraison Klambo (ou tentative + fallback) — un job après l’autre. */
export function enqueueSchoolNotifyTask<T>(
  task: () => Promise<T>,
  kind: SchoolNotifyQueueKind = "other",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    laneOf(kind).push({
      kind,
      runTask: () => task(),
      resolve: (value) => resolve(value as T),
      reject,
    });
    void pumpSchoolNotifyQueue();
  });
}

export function getSchoolNotifyQueueDepth(): number {
  let n = 0;
  for (const lane of lanes.values()) n += lane.length;
  return n;
}

/** Réservé aux tests. */
export function __resetSchoolNotifyQueueForTests() {
  lastRunAt = 0;
  lastServedKind = null;
  pumpRunning = false;
  lanes.clear();
}
