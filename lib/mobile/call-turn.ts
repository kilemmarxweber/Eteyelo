import { createHmac } from "node:crypto";

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type IceBuildSource = "house" | "openrelay" | "static";

export type IceBuildResult = {
  iceServers: IceServer[];
  source: IceBuildSource;
  /** true si TURN_FORCE_RELAY=1 — le client peut forcer iceTransportPolicy:relay */
  preferRelay: boolean;
  ttlSec: number;
};

/**
 * Peu de STUN : assez pour le même Wi‑Fi, sans ralentir la collecte.
 * Trop d'entrées (53, nextcloud…) allongeait le délai avant le relais.
 */
export const PUBLIC_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun.cloudflare.com:3478",
];

/**
 * Relais public si aucun TURN maison, ou en secours derrière le TURN maison.
 * TLS/TCP 443 (Wi‑Fi publics filtrés) puis UDP 443.
 * Le média reste chiffré (DTLS-SRTP).
 */
export const OPEN_RELAY_URLS = [
  "turns:staticauth.openrelay.metered.ca:443?transport=tcp",
  "turn:staticauth.openrelay.metered.ca:443",
];

export const OPEN_RELAY_SECRET = "openrelayprojectsecret";

/** Identifiants TURN éphémères (REST API coturn : username = expiry:user). */
export function turnRestCredential(params: {
  userId: string;
  secret: string;
  ttlSec: number;
  nowSec?: number;
}) {
  const ttl = Math.max(60, Math.min(params.ttlSec, 86_400));
  const now = params.nowSec ?? Math.floor(Date.now() / 1000);
  const username = `${now + ttl}:${params.userId}`;
  const credential = createHmac("sha1", params.secret)
    .update(username)
    .digest("base64");
  return { username, credential, ttlSec: ttl };
}

function splitUrls(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

function parseHostPort(url: string): { host: string; port: string } | null {
  // turn:host:3478 | turns:host:443?transport=tcp | turn:host:3478?transport=tcp
  const m = url.match(/^(turns?):([^:?]+)(?::(\d+))?/i);
  if (!m) return null;
  return { host: m[2]!, port: m[3] ?? "3478" };
}

/**
 * À partir d'une URL UDP 3478, ajoute TCP 3478 + TLS/TCP **5349** (standard
 * coturn, libre si Nginx tient déjà le 443) sur le même hôte.
 */
export function expandHouseTurnUrls(urls: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    if (seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  for (const raw of urls) {
    push(raw);
    const parsed = parseHostPort(raw);
    if (!parsed) continue;
    const { host, port } = parsed;
    const hasTransport = raw.includes("?transport=");
    const isTurns = raw.startsWith("turns:");

    // Variante TCP explicite sur le même port.
    if (!hasTransport && !isTurns) {
      push(`turn:${host}:${port}?transport=tcp`);
    }

    // Chemin TLS 5349 (cohabite avec Nginx sur 443) si on part d'un 3478.
    if (port === "3478" || port === "53") {
      push(`turns:${host}:5349?transport=tcp`);
      push(`turn:${host}:5349?transport=tcp`);
      push(`turn:${host}:5349`);
    }
  }

  return out;
}

function envFlag(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null || raw.trim() === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(v)) return false;
  if (["1", "true", "yes", "on"].includes(v)) return true;
  return defaultValue;
}

/**
 * TURN d'abord (réseau public / CGNAT), STUN ensuite.
 * TURN maison + secours Metered (sauf si TURN_KEEP_PUBLIC_FALLBACK=0).
 */
export function buildIceServers(params: {
  userId: string;
  turnUrls?: string;
  turnSecret?: string;
  turnUser?: string;
  turnCredential?: string;
  /** Secours supplémentaire (CSV), sinon OPEN_RELAY si keepPublicFallback. */
  turnFallbackUrls?: string;
  turnFallbackSecret?: string;
  keepPublicFallback?: boolean;
  expandUrls?: boolean;
  preferRelay?: boolean;
  ttlSec?: number;
  nowSec?: number;
}): IceServer[] {
  return buildIceConfig(params).iceServers;
}

export function buildIceConfig(params: {
  userId: string;
  turnUrls?: string;
  turnSecret?: string;
  turnUser?: string;
  turnCredential?: string;
  turnFallbackUrls?: string;
  turnFallbackSecret?: string;
  keepPublicFallback?: boolean;
  expandUrls?: boolean;
  preferRelay?: boolean;
  ttlSec?: number;
  nowSec?: number;
}): IceBuildResult {
  const ttlSec = Math.max(60, Math.min(params.ttlSec ?? 3600, 86_400));
  const expand = params.expandUrls !== false;
  const keepFallback = params.keepPublicFallback !== false;
  const preferRelay = params.preferRelay === true;

  const configured = splitUrls(params.turnUrls);
  const secret = params.turnSecret?.trim();
  const user = params.turnUser?.trim();
  const credential = params.turnCredential?.trim();

  const turns: IceServer[] = [];
  let source: IceBuildSource = "openrelay";

  if (configured.length > 0 && secret) {
    const creds = turnRestCredential({
      userId: params.userId,
      secret,
      ttlSec,
      nowSec: params.nowSec,
    });
    const urls = expand ? expandHouseTurnUrls(configured) : configured;
    pushParallelTurn(turns, urls, creds.username, creds.credential);
    source = "house";
  } else if (configured.length > 0 && user && credential) {
    const urls = expand ? expandHouseTurnUrls(configured) : configured;
    pushParallelTurn(turns, urls, user, credential);
    source = "static";
  }

  // Secours : TURN_FALLBACK_URLS custom, sinon Metered Open Relay.
  if (source === "house" || source === "static") {
    if (keepFallback) {
      const fallbackUrls = splitUrls(params.turnFallbackUrls);
      if (fallbackUrls.length > 0) {
        const fbSecret = params.turnFallbackSecret?.trim() || OPEN_RELAY_SECRET;
        const creds = turnRestCredential({
          userId: params.userId,
          secret: fbSecret,
          ttlSec,
          nowSec: params.nowSec,
        });
        pushParallelTurn(turns, fallbackUrls, creds.username, creds.credential);
      } else {
        const creds = turnRestCredential({
          userId: params.userId,
          secret: OPEN_RELAY_SECRET,
          ttlSec,
          nowSec: params.nowSec,
        });
        pushParallelTurn(turns, OPEN_RELAY_URLS, creds.username, creds.credential);
      }
    }
  } else {
    const creds = turnRestCredential({
      userId: params.userId,
      secret: OPEN_RELAY_SECRET,
      ttlSec,
      nowSec: params.nowSec,
    });
    pushParallelTurn(turns, OPEN_RELAY_URLS, creds.username, creds.credential);
    source = "openrelay";
  }

  const stuns: IceServer[] = PUBLIC_STUN_URLS.map((urls) => ({ urls }));
  // TURN avant STUN : sur Wi‑Fi public le relais démarre sans attendre les STUN morts.
  return {
    iceServers: [...turns, ...stuns],
    source,
    preferRelay,
    ttlSec,
  };
}

/** Construit la config depuis les variables d'environnement process. */
export function buildIceConfigFromEnv(params: {
  userId: string;
  env?: NodeJS.ProcessEnv;
  nowSec?: number;
}): IceBuildResult {
  const env = params.env ?? process.env;
  const ttl = Number(env.TURN_TTL_SEC ?? 3600);
  return buildIceConfig({
    userId: params.userId,
    turnUrls: env.TURN_URLS,
    turnSecret: env.TURN_SECRET,
    turnUser: env.TURN_USERNAME,
    turnCredential: env.TURN_CREDENTIAL,
    turnFallbackUrls: env.TURN_FALLBACK_URLS,
    turnFallbackSecret: env.TURN_FALLBACK_SECRET,
    keepPublicFallback: envFlag(env.TURN_KEEP_PUBLIC_FALLBACK, true),
    expandUrls: envFlag(env.TURN_EXPAND_URLS, true),
    preferRelay: envFlag(env.TURN_FORCE_RELAY, false),
    ttlSec: Number.isFinite(ttl) ? ttl : 3600,
    nowSec: params.nowSec,
  });
}

/**
 * Une entrée par URL : WebRTC les alloue en parallèle.
 * Un seul tableau `urls` les essaie dans l'ordre et ajoute ~30 s
 * dès que le premier port est filtré.
 */
function pushParallelTurn(
  iceServers: IceServer[],
  urls: string[],
  username: string,
  credential: string,
) {
  if (urls.length === 1) {
    iceServers.push({ urls, username, credential });
    return;
  }
  for (const url of urls) {
    iceServers.push({ urls: url, username, credential });
  }
}
