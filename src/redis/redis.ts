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
    retryStrategy(times) {
      if (times > 10) return null;
      return Math.min(times * 200, 2000);
    },
  });

  client.on("error", (error: NodeJS.ErrnoException) => {
    // Évite le flood console (ioredis réémet à chaque tentative).
    if (error?.code === "ECONNREFUSED") return;
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
    try {
      _connection.removeAllListeners();
      _connection.disconnect();
    } catch {
      // ignore
    }
    _connection = null;
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
 */
export async function ensureRedisReady() {
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
      await redis.connect();
    }
    return redis;
  }

  if (
    redis.status === "connecting" ||
    redis.status === "connect" ||
    redis.status === "reconnecting"
  ) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Redis connect timeout"));
      }, 8000);
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
      redis.once("ready", onReady);
      redis.once("end", onEnd);
    });
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
