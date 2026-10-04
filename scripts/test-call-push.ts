/**
 * Réveil d'appel : pas d'envoi sans clé FCM, message data-only sinon.
 * Run: pnpm exec tsx scripts/test-call-push.ts
 */
import assert from "node:assert/strict";
import {
  buildFcmCallMessage,
  shouldSendCallPush,
} from "../lib/mobile/call-push";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

test("sans clé FCM on n'envoie rien", () => {
  assert.equal(shouldSendCallPush(undefined), false);
  assert.equal(shouldSendCallPush(""), false);
  assert.equal(shouldSendCallPush("  "), false);
  assert.equal(shouldSendCallPush("server-key"), true);
});

test("le push ne transporte pas le média, seulement l'offre", () => {
  const message = buildFcmCallMessage({
    token: "device-token",
    callId: "call-1",
    callerName: "Amina",
    kind: "AUDIO",
  });
  assert.equal(message.priority, "high");
  assert.equal(message.to, "device-token");
  assert.equal(message.data.type, "call.offer");
  assert.equal(message.data.callId, "call-1");
  assert.equal("notification" in message, false);
});

console.log("\nAll call push tests passed.");
