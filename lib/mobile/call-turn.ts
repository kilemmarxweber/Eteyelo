import { createHmac } from "node:crypto";

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
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
 * Relais public si aucun TURN maison. Deux chemins seulement :
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

/**
 * STUN pour le chemin direct, plus un TURN court.
 * Le TURN maison (TURN_URLS) prime sur le relais public.
 */
export function buildIceServers(params: {
  userId: string;
  turnUrls?: string;
  turnSecret?: string;
  turnUser?: string;
  turnCredential?: string;
  ttlSec?: number;
  nowSec?: number;
}): IceServer[] {
  const iceServers: IceServer[] = PUBLIC_STUN_URLS.map((urls) => ({ urls }));
  const configured = splitUrls(params.turnUrls);
  const secret = params.turnSecret?.trim();
  const user = params.turnUser?.trim();
  const credential = params.turnCredential?.trim();

  if (configured.length > 0 && secret) {
    const creds = turnRestCredential({
      userId: params.userId,
      secret,
      ttlSec: params.ttlSec ?? 3600,
      nowSec: params.nowSec,
    });
    pushParallelTurn(iceServers, configured, creds.username, creds.credential);
    return iceServers;
  }

  if (configured.length > 0 && user && credential) {
    pushParallelTurn(iceServers, configured, user, credential);
    return iceServers;
  }

  const creds = turnRestCredential({
    userId: params.userId,
    secret: OPEN_RELAY_SECRET,
    ttlSec: params.ttlSec ?? 3600,
    nowSec: params.nowSec,
  });
  pushParallelTurn(iceServers, OPEN_RELAY_URLS, creds.username, creds.credential);
  return iceServers;
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
