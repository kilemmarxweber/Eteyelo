import { createHmac } from "node:crypto";

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/** STUN joignables même quand le port 3478 est filtré. */
export const PUBLIC_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun.cloudflare.com:3478",
];

/**
 * Relais public (UDP 80 + TCP 443) utilisé seulement si aucun TURN maison
 * n'est configuré. Le secret est celui publié pour l'auth statique coturn.
 * Le média reste chiffré (DTLS-SRTP) : le relais ne voit pas la voix.
 */
export const OPEN_RELAY_URLS = [
  "turn:staticauth.openrelay.metered.ca:80",
  "turn:staticauth.openrelay.metered.ca:80?transport=tcp",
  "turn:staticauth.openrelay.metered.ca:443",
  "turns:staticauth.openrelay.metered.ca:443?transport=tcp",
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
    iceServers.push({
      urls: configured,
      username: creds.username,
      credential: creds.credential,
    });
    return iceServers;
  }

  if (configured.length > 0 && user && credential) {
    iceServers.push({
      urls: configured,
      username: user,
      credential,
    });
    return iceServers;
  }

  const creds = turnRestCredential({
    userId: params.userId,
    secret: OPEN_RELAY_SECRET,
    ttlSec: params.ttlSec ?? 3600,
    nowSec: params.nowSec,
  });
  iceServers.push({
    urls: OPEN_RELAY_URLS,
    username: creds.username,
    credential: creds.credential,
  });
  return iceServers;
}
