import { ensureRedisReady, getRedisConnection } from "@/src/redis/redis";

const TTL_SEC = 180;

export type CallSignalBlob = {
  offer?: unknown;
  answer?: unknown;
  ice: Array<{ fromUserId: string; payload: unknown }>;
};

const memory = new Map<string, { blob: CallSignalBlob; exp: number }>();

function key(callId: string) {
  return `klambo:call-signal:${callId}`;
}

function emptyBlob(): CallSignalBlob {
  return { ice: [] };
}

function readMemory(callId: string): CallSignalBlob | null {
  const row = memory.get(callId);
  if (!row) return null;
  if (row.exp < Date.now()) {
    memory.delete(callId);
    return null;
  }
  return row.blob;
}

function writeMemory(callId: string, blob: CallSignalBlob) {
  memory.set(callId, { blob, exp: Date.now() + TTL_SEC * 1000 });
}

async function readRedis(callId: string): Promise<CallSignalBlob | null> {
  try {
    await ensureRedisReady(800);
    const raw = await getRedisConnection().get(key(callId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CallSignalBlob;
    if (!Array.isArray(parsed.ice)) parsed.ice = [];
    return parsed;
  } catch {
    return null;
  }
}

async function writeRedis(callId: string, blob: CallSignalBlob) {
  try {
    await ensureRedisReady(800);
    await getRedisConnection().set(key(callId), JSON.stringify(blob), "EX", TTL_SEC);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[call-signal] redis write failed: ${message}`);
  }
}

export async function readCallSignal(callId: string): Promise<CallSignalBlob> {
  const fromRedis = await readRedis(callId);
  const fromMemory = readMemory(callId);
  if (!fromRedis && !fromMemory) return emptyBlob();
  const ice = [...(fromRedis?.ice ?? []), ...(fromMemory?.ice ?? [])];
  const seen = new Set<string>();
  const mergedIce = ice.filter((item) => {
    const mark = `${item.fromUserId}:${JSON.stringify(item.payload)}`;
    if (seen.has(mark)) return false;
    seen.add(mark);
    return true;
  });
  return {
    offer: fromRedis?.offer ?? fromMemory?.offer,
    answer: fromRedis?.answer ?? fromMemory?.answer,
    ice: mergedIce.slice(-50),
  };
}

export async function saveCallOffer(callId: string, offer: unknown) {
  const blob = await readCallSignal(callId);
  blob.offer = offer;
  writeMemory(callId, blob);
  await writeRedis(callId, blob);
}

export async function saveCallAnswer(callId: string, answer: unknown) {
  const blob = await readCallSignal(callId);
  blob.answer = answer;
  writeMemory(callId, blob);
  await writeRedis(callId, blob);
}

export async function appendCallIce(
  callId: string,
  fromUserId: string,
  payload: unknown,
) {
  const blob = await readCallSignal(callId);
  blob.ice.push({ fromUserId, payload });
  blob.ice = blob.ice.slice(-50);
  writeMemory(callId, blob);
  await writeRedis(callId, blob);
}
