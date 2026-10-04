/**
 * Téléphone de fiche, même présence que le prénom et le nom.
 * Run: pnpm exec tsx scripts/test-messaging-phone.ts
 */
import assert from "node:assert/strict";
import { messagingAccountPhone } from "../lib/messaging/messaging-types";

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

console.log("\nAll messaging phone tests passed.");
