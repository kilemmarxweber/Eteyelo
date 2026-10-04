/**
 * Téléphone de fiche, même présence que le prénom et le nom.
 * Run: pnpm exec tsx scripts/test-messaging-phone.ts
 */
import assert from "node:assert/strict";
import {
  messagingAccountPhone,
  parseConversationSince,
} from "../lib/messaging/messaging-types";
import { realtimeAudience } from "../lib/mobile/realtime";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

test("reprend le numéro du compte", () => {
  assert.equal(messagingAccountPhone("+243844952966"), "+243844952966");
  assert.equal(messagingAccountPhone("  0890123456  "), "0890123456");
});

test("vide si le compte n'a pas de numéro", () => {
  assert.equal(messagingAccountPhone(null), null);
  assert.equal(messagingAccountPhone("   "), null);
  assert.equal(messagingAccountPhone(undefined), null);
});

test("le rattrapage ignore une date vide ou invalide", () => {
  assert.equal(parseConversationSince(null), null);
  assert.equal(parseConversationSince("  "), null);
  assert.equal(parseConversationSince("hier"), null);
  const date = parseConversationSince("2026-04-01T00:00:00.000Z");
  assert.ok(date instanceof Date);
  assert.equal(date?.toISOString(), "2026-04-01T00:00:00.000Z");
});

test("l'expéditeur reçoit aussi son message sur le socket", () => {
  const ids = realtimeAudience({
    type: "message.created",
    organizationId: "org",
    conversationId: "c1",
    messageId: "m1",
    senderId: "me",
    recipientUserIds: ["peer"],
  });
  assert.deepEqual(ids, ["peer", "me"]);
  const calls = realtimeAudience({
    type: "call.offer",
    organizationId: "org",
    callId: "k1",
    fromUserId: "me",
    toUserId: "peer",
  });
  assert.deepEqual(calls, ["peer"]);
});

console.log("\nAll messaging phone tests passed.");
