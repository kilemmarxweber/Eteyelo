import { createHmac } from "node:crypto";

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/**
 * STUN publics, un port par entrée (collecte en parallèle).
 * 19302 et 3478 sont souvent filtrés ; 53 (DNS) et 443 passent
 * sur beaucoup de réseaux où le chemin direct serait sinon impossible.
 */
export const PUBLIC_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun.cloudflare.com:3478",
  "stun:stun.cloudflare.com:53",
  "stun:stun.nextcloud.com:443",
];

/**
 * Relais public (UDP 80 + TCP 443) utilisé seulement si aucun TURN maison
 * n'est configuré. Le secret est celui publié pour l'auth statique coturn.
 * Le média reste chiffré (DTLS-SRTP) : le relais ne voit pas la voix.
 */
/** 443 d'abord : c'est le port qui passe quand 3478 et parfois 80 sont filtrés. */
export const OPEN_RELAY_URLS = [
  "turns:staticauth.openrelay.metered.ca:443?transport=tcp",
  "turn:staticauth.openrelay.metered.ca:443",
  "turn:staticauth.openrelay.metered.ca:443?transport=tcp",
  "turn:staticauth.openrelay.metered.ca:80",
  "turn:staticauth.openrelay.metered.ca:80?transport=tcp",
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
 * STUN pour le chemin direct entre réseaux, plus un TURN.
 * Le TURN maison (TURN_URLS + secret ou identifiants) prime.
 * Sinon le relais public permet l'appel derrière un autre routeur ou à l'étranger.
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
