/**
 * Politique de signaling d'appel (relay, occupé, ICE dupliqué).
 * Run: pnpm exec tsx scripts/test-call-signaling.ts
 */
import assert from "node:assert/strict";
import {
  isCallSignalType,
  isDuplicateIce,
  shouldMarkBusy,
} from "../lib/mobile/call-signaling-policy";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

test("relaye ack, busy et renegotiate", () => {
  assert.equal(isCallSignalType("call.ack"), true);
  assert.equal(isCallSignalType("call.busy"), true);
  assert.equal(isCallSignalType("call.renegotiate"), true);
  assert.equal(isCallSignalType("call.restart-request"), true);
  assert.equal(isCallSignalType("typing"), false);
});

test("occupé seulement par le destinataire d'un appel qui sonne", () => {
  assert.equal(
    shouldMarkBusy({
      type: "call.busy",
      senderId: "callee",
      calleeId: "callee",
      status: "RINGING",
    }),
    true,
  );
  assert.equal(
    shouldMarkBusy({
      type: "call.busy",
      senderId: "caller",
      calleeId: "callee",
      status: "RINGING",
    }),
    false,
  );
  assert.equal(
    shouldMarkBusy({
      type: "call.busy",
      senderId: "callee",
      calleeId: "callee",
      status: "ACTIVE",
    }),
    false,
  );
});

test("candidat ICE déjà stocké est ignoré", () => {
  const existing = [
    { fromUserId: "a", payload: { candidate: "cand-1" } },
    { fromUserId: "a", payload: { sdpMid: "0", sdpMLineIndex: 0 } },
  ];
  assert.equal(
    isDuplicateIce(existing, "a", { candidate: "cand-1" }),
    true,
  );
  assert.equal(
    isDuplicateIce(existing, "b", { candidate: "cand-1" }),
    false,
  );
  assert.equal(
    isDuplicateIce(existing, "a", { candidate: "cand-2" }),
    false,
  );
  // Sans candidate : dédupliquer sur le payload entier
  assert.equal(
    isDuplicateIce(existing, "a", { sdpMid: "0", sdpMLineIndex: 0 }),
    true,
  );
  assert.equal(
    isDuplicateIce(existing, "a", { sdpMid: "1", sdpMLineIndex: 0 }),
    false,
  );
});

console.log("\nAll call signaling tests passed.");
