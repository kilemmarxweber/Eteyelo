// src/redis/redis.ts
import IORedis from "ioredis";

/**
 * Connexion Redis lazy + tolérante : sans Redis local (Docker arrêté),
 * l'app ne spam plus ECONNREFUSED et les pages hors files BullMQ restent utilisables.
 */
let _connection: IORedis | null = null;

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

/** @deprecated Préférer getRedisConnection() — conservé pour les imports existants. */
export const connection = new Proxy({} as IORedis, {
  get(_target, prop, receiver) {
    const client = getRedisConnection();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
