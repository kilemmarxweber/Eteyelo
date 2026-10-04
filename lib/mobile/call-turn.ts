import { createHmac } from "node:crypto";

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
