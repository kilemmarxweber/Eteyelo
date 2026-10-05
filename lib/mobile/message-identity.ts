import { prisma } from "@/lib/prisma";
import { ensureRedisReady, getRedisConnection } from "@/src/redis/redis";

const memory = new Map<string, string>();
let tableReady = false;

/** Clé publique X25519, 32 octets en base64 standard. */
export function isValidMessagePublicKey(value: string) {
  if (!value || typeof value !== "string") return false;
  try {
    const buf = Buffer.from(value, "base64");
    if (buf.length !== 32) return false;
    return buf.toString("base64") === value;
  } catch {
    return false;
  }
}

function redisKey(userId: string) {
  return `klambo:message-identity:${userId}`;
}

async function ensureTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS message_identity (
      user_id TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

export async function saveMessagePublicKey(userId: string, publicKey: string) {
  memory.set(userId, publicKey);
  try {
    await ensureTable();
    await prisma.$executeRaw`
      INSERT INTO message_identity (user_id, public_key, updated_at)
      VALUES (${userId}, ${publicKey}, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET public_key = ${publicKey}, updated_at = NOW()
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[message-identity] postgres write failed: ${message}`);
  }
  try {
    await ensureRedisReady(800);
    await getRedisConnection().set(redisKey(userId), publicKey);
  } catch {
    // mémoire + postgres suffisent sur une instance
  }
}

export async function readMessagePublicKey(userId: string) {
  try {
    await ensureTable();
    const rows = await prisma.$queryRaw<Array<{ public_key: string }>>`
      SELECT public_key FROM message_identity WHERE user_id = ${userId} LIMIT 1
    `;
    const fromDb = rows[0]?.public_key;
    if (fromDb) {
      memory.set(userId, fromDb);
      return fromDb;
    }
  } catch {
    // repli
  }
  try {
    await ensureRedisReady(800);
    const fromRedis = await getRedisConnection().get(redisKey(userId));
    if (fromRedis) {
      memory.set(userId, fromRedis);
      return fromRedis;
    }
  } catch {
    // repli
  }
  return memory.get(userId) ?? null;
}
