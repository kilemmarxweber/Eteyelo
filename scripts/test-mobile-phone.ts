/**
 * Tests normalisation téléphone mobile.
 * Run: pnpm exec tsx scripts/test-mobile-phone.ts
 */
import assert from "node:assert/strict";
import {
  normalizePhoneE164,
  phoneLookupVariants,
} from "../lib/mobile/phone";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

test("local CD 0xxxxxxxxx → +243", () => {
  assert.equal(normalizePhoneE164("0890123456"), "+243890123456");
});

test("déjà E.164", () => {
  assert.equal(normalizePhoneE164("+243890123456"), "+243890123456");
});

test("9 chiffres sans 0", () => {
  assert.equal(normalizePhoneE164("890123456"), "+243890123456");
});

test("variants lookup", () => {
  const v = phoneLookupVariants("+243890123456");
  assert.ok(v.includes("+243890123456"));
  assert.ok(v.includes("243890123456"));
  assert.ok(v.includes("0890123456"));
});

test("invalide", () => {
  assert.equal(normalizePhoneE164("123"), null);
  assert.equal(normalizePhoneE164(""), null);
});

console.log("\nAll mobile phone tests passed.");
