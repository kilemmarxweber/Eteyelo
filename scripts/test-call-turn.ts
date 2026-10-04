/**
 * Identifiants TURN à durée limitée.
 * Run: pnpm exec tsx scripts/test-call-turn.ts
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  OPEN_RELAY_URLS,
  buildIceServers,
  turnRestCredential,
} from "../lib/mobile/call-turn";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

test("username = expiration:utilisateur et HMAC-SHA1", () => {
  const creds = turnRestCredential({
    userId: "user-1",
    secret: "turn-secret",
    ttlSec: 600,
    nowSec: 1_700_000_000,
  });
  assert.equal(creds.username, "1700000600:user-1");
  const expected = createHmac("sha1", "turn-secret")
    .update("1700000600:user-1")
    .digest("base64");
  assert.equal(creds.credential, expected);
  assert.equal(creds.ttlSec, 600);
});

test("TTL borné entre 1 minute et 1 jour", () => {
  const short = turnRestCredential({
    userId: "u",
    secret: "s",
    ttlSec: 1,
    nowSec: 10,
  });
  assert.equal(short.username.startsWith("70:"), true);
  const long = turnRestCredential({
    userId: "u",
    secret: "s",
    ttlSec: 999_999,
    nowSec: 10,
  });
  assert.equal(long.ttlSec, 86_400);
});

test("sans TURN maison, un relais internet est ajouté", () => {
  const servers = buildIceServers({ userId: "user-1", nowSec: 1_700_000_000 });
  const turn = servers.find((s) => {
    const urls = Array.isArray(s.urls) ? s.urls.join(" ") : s.urls;
    return urls.includes("turn:");
  });
  assert.ok(turn);
  assert.deepEqual(turn.urls, OPEN_RELAY_URLS);
  assert.equal(turn.username, "1700003600:user-1");
  assert.ok(turn.credential);
  assert.ok(servers.some((s) => s.urls === "stun:stun.cloudflare.com:3478"));
});

test("TURN_URLS maison remplace le relais public", () => {
  const servers = buildIceServers({
    userId: "user-1",
    turnUrls: "turn:turn.klambocore.com:3478",
    turnSecret: "maison",
    nowSec: 1_700_000_000,
  });
  const turn = servers.find((s) => {
    const urls = Array.isArray(s.urls) ? s.urls.join(" ") : s.urls;
    return urls.includes("turn:");
  });
  assert.deepEqual(turn?.urls, ["turn:turn.klambocore.com:3478"]);
  assert.equal(turn?.username, "1700003600:user-1");
});

console.log("\nAll TURN credential tests passed.");
