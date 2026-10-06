/**
 * Identifiants TURN à durée limitée + expansion multi-transport.
 * Run: pnpm exec tsx scripts/test-call-turn.ts
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  OPEN_RELAY_URLS,
  buildIceConfig,
  buildIceServers,
  expandHouseTurnUrls,
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

test("sans TURN maison, un relais internet est ajouté avant les STUN", () => {
  const servers = buildIceServers({ userId: "user-1", nowSec: 1_700_000_000 });
  const first = servers[0];
  assert.ok(first);
  assert.equal(first.urls, OPEN_RELAY_URLS[0]);
  const turns = servers.filter((s) => {
    const urls = Array.isArray(s.urls) ? s.urls.join(" ") : s.urls;
    return urls.includes("turn:") || urls.includes("turns:");
  });
  assert.deepEqual(
    turns.map((s) => s.urls),
    OPEN_RELAY_URLS,
  );
  assert.equal(turns[0]?.username, "1700003600:user-1");
  assert.ok(turns[0]?.credential);
  assert.ok(servers.some((s) => s.urls === "stun:stun.cloudflare.com:3478"));
  assert.equal(
    servers.some((s) => s.urls === "stun:stun.cloudflare.com:53"),
    false,
  );
  assert.equal(
    servers.some((s) => String(s.urls).includes(":80")),
    false,
  );
});

test("expandHouseTurnUrls ajoute TCP et 443", () => {
  const expanded = expandHouseTurnUrls(["turn:turn.klambocore.com:3478"]);
  assert.ok(expanded.includes("turn:turn.klambocore.com:3478"));
  assert.ok(expanded.includes("turn:turn.klambocore.com:3478?transport=tcp"));
  assert.ok(expanded.includes("turns:turn.klambocore.com:443?transport=tcp"));
  assert.ok(expanded.includes("turn:turn.klambocore.com:443"));
});

test("TURN maison + secours public Metered", () => {
  const built = buildIceConfig({
    userId: "user-1",
    turnUrls: "turn:turn.klambocore.com:3478",
    turnSecret: "maison",
    expandUrls: false,
    keepPublicFallback: true,
    nowSec: 1_700_000_000,
  });
  assert.equal(built.source, "house");
  const turnUrls = built.iceServers
    .map((s) => (Array.isArray(s.urls) ? s.urls[0] : s.urls))
    .filter((u): u is string => !!u && (u.includes("turn:") || u.includes("turns:")));
  assert.ok(turnUrls.some((u) => u.includes("turn.klambocore.com")));
  assert.ok(turnUrls.some((u) => u.includes("openrelay.metered.ca")));
  // Premier = maison
  assert.deepEqual(built.iceServers[0]?.urls, [
    "turn:turn.klambocore.com:3478",
  ]);
});

test("TURN maison sans secours public si désactivé", () => {
  const built = buildIceConfig({
    userId: "user-1",
    turnUrls: "turn:turn.klambocore.com:3478",
    turnSecret: "maison",
    expandUrls: false,
    keepPublicFallback: false,
    nowSec: 1_700_000_000,
  });
  const turnUrls = built.iceServers
    .map((s) => String(s.urls))
    .filter((u) => u.includes("turn:") || u.includes("turns:"));
  assert.equal(turnUrls.length, 1);
  assert.equal(turnUrls.some((u) => u.includes("metered")), false);
});

test("expansion auto sur TURN_URLS maison", () => {
  const built = buildIceConfig({
    userId: "user-1",
    turnUrls: "turn:turn.klambocore.com:3478",
    turnSecret: "maison",
    expandUrls: true,
    keepPublicFallback: false,
    nowSec: 1_700_000_000,
  });
  const urls = built.iceServers
    .map((s) => (Array.isArray(s.urls) ? s.urls[0] : s.urls))
    .filter((u): u is string => !!u && u.includes("klambocore"));
  assert.ok(urls.length >= 3);
  assert.ok(urls.some((u) => u.includes(":443")));
});

console.log("\nAll TURN credential tests passed.");
