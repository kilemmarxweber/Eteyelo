// src/redis/redis.ts
import IORedis from "ioredis";

/**
 * Connexion Redis lazy + tolérante : sans Redis local (Docker arrêté),
 * l'app ne spam plus ECONNREFUSED et les pages hors files BullMQ restent utilisables.
 */
let _connection: IORedis | null = null;
const resetListeners = new Set<() => void>();

function createConnection() {
  const url = process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";

  const client = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 1500,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });

  client.on("error", (error: NodeJS.ErrnoException) => {
    // Évite le flood console (ioredis réémet à chaque tentative).
    if (
      error?.code === "ECONNREFUSED" ||
      error?.code === "ECONNRESET" ||
      error?.code === "ETIMEDOUT" ||
      error?.message === "Connection is closed." ||
      error?.message === "aborted"
    ) {
      return;
    }
    console.error("[redis]", error.message);
  });

  return client;
}

export function getRedisConnection() {
  if (!_connection) {
    _connection = createConnection();
  }
  return _connection;
}

/** Notifie les files BullMQ pour qu'elles recréent leur Queue. */
export function onRedisConnectionReset(listener: () => void) {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

export function resetRedisConnection() {
  if (_connection) {
    const old = _connection;
    _connection = null;
    try {
      // Garder un handler d'erreur pendant la coupure pour éviter uncaughtException.
      old.on("error", () => undefined);
      old.disconnect();
      old.removeAllListeners();
    } catch {
      // ignore
    }
  }
  for (const listener of resetListeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

/**
 * Garantit une connexion Redis utilisable (reconnexion après Redis coupé).
 * @param timeoutMs délai max d'attente (court pour le publish mobile).
 */
export async function ensureRedisReady(timeoutMs = 1500) {
  let redis = getRedisConnection();

  if (redis.status === "ready") return redis;

  if (
    redis.status === "end" ||
    redis.status === "close" ||
    redis.status === "wait"
  ) {
    if (redis.status === "end" || redis.status === "close") {
      resetRedisConnection();
      redis = getRedisConnection();
    }
    if (redis.status !== "ready") {
      try {
        await Promise.race([
          redis.connect(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Redis connect timeout")),
              timeoutMs,
            ),
          ),
        ]);
      } catch (error) {
        resetRedisConnection();
        throw error;
      }
    }
    return redis;
  }

  if (
    redis.status === "connecting" ||
    redis.status === "connect" ||
    redis.status === "reconnecting"
  ) {
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Redis connect timeout"));
        }, timeoutMs);
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onEnd = () => {
          cleanup();
          reject(new Error("Redis connection ended"));
        };
        const cleanup = () => {
          clearTimeout(timeout);
          redis.off("ready", onReady);
          redis.off("end", onEnd);
        };
        if (redis.status === "ready") {
          cleanup();
          resolve();
          return;
        }
        redis.once("ready", onReady);
        redis.once("end", onEnd);
      });
    } catch (error) {
      resetRedisConnection();
      throw error;
    }
  }

  return redis;
}

/** @deprecated Préférer getRedisConnection() — conservé pour les imports existants. */
export const connection = new Proxy({} as IORedis, {
  get(_target, prop, receiver) {
    const client = getRedisConnection();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
