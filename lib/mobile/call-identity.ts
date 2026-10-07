import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ensureRedisReady, getRedisConnection } from "@/src/redis/redis";

const memory = new Map<string, string>();
let tableReady = false;

const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

export function canonicalDtlsFingerprints(sdp: string) {
  const found = new Set<string>();
  const re = /a=fingerprint:\S+\s+([0-9A-Fa-f:]+)/g;
  for (const match of sdp.matchAll(re)) {
    found.add(match[1].toUpperCase());
  }
  return [...found].sort().join("|");
}

export function isValidCallPublicKey(value: string) {
  if (!value || typeof value !== "string") return false;
  try {
    const buf = Buffer.from(value.trim(), "base64");
    // 32 octets Ed25519 — accepter padding base64 Dart/Node différent.
    return buf.length === 32;
  } catch {
    return false;
  }
}

/** Normalise une clé publique en base64 standard (padding). */
export function normalizeCallPublicKey(value: string) {
  return Buffer.from(value.trim(), "base64").toString("base64");
}

export function publicKeyFromSeed(seed: Buffer) {
  const pkcs8 = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
  const priv = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
  const pub = createPublicKey(priv);
  const raw = pub.export({ format: "der", type: "spki" });
  return raw.subarray(raw.length - 32);
}

export function signFingerprint(seed: Buffer, fingerprint: string) {
  const pkcs8 = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
  const priv = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
  return sign(null, Buffer.from(fingerprint, "utf8"), priv);
}

export function verifyFingerprint(params: {
  publicKey: Buffer;
  fingerprint: string;
  signature: Buffer;
}) {
  const spki = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    params.publicKey,
  ]);
  const pub = createPublicKey({ key: spki, format: "der", type: "spki" });
  return verify(
    null,
    Buffer.from(params.fingerprint, "utf8"),
    pub,
    params.signature,
  );
}

function redisKey(userId: string) {
  return `klambo:call-identity:${userId}`;
}

async function ensureTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS call_identity (
      user_id TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

export async function saveCallPublicKey(userId: string, publicKey: string) {
  const normalized = normalizeCallPublicKey(publicKey);
  memory.set(userId, normalized);
  try {
    await ensureTable();
    await prisma.$executeRaw`
      INSERT INTO call_identity (user_id, public_key, updated_at)
      VALUES (${userId}, ${normalized}, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET public_key = ${normalized}, updated_at = NOW()
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[call-identity] postgres write failed: ${message}`);
  }
  try {
    await ensureRedisReady(800);
    await getRedisConnection().set(redisKey(userId), normalized);
  } catch {
    // mémoire + postgres suffisent sur une instance
  }
}

export async function readCallPublicKey(userId: string) {
  try {
    await ensureTable();
    const rows = await prisma.$queryRaw<Array<{ public_key: string }>>`
      SELECT public_key FROM call_identity WHERE user_id = ${userId} LIMIT 1
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
