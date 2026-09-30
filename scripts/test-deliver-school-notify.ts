/**
 * deliverSchoolNotify — règles pures (sans DB).
 * Run: pnpm exec tsx scripts/test-deliver-school-notify.ts
 */
import assert from "node:assert/strict";
import {
  canCreateGroup,
  canUseMessaging,
  isEligibleMessagingRecipient,
  isMessagingEligibleRole,
} from "../lib/messaging/messaging-policy";
import { ORG_ROLE, organizationRoleStatements } from "../lib/permissions";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("parent et élève éligibles inbox (prérequis deliverSchoolNotify)", () => {
  assert.equal(isMessagingEligibleRole(ORG_ROLE.PARENT), true);
  assert.equal(isMessagingEligibleRole(ORG_ROLE.STUDENT), true);
  assert.equal(
    isEligibleMessagingRecipient({ memberRole: ORG_ROLE.STUDENT }),
    true,
  );
  assert.equal(canUseMessaging({ memberRole: ORG_ROLE.PARENT }), true);
});

test("DAC parent/élève expose messaging read+send", () => {
  assert.deepEqual(organizationRoleStatements[ORG_ROLE.PARENT].messaging, [
    "read",
    "send",
  ]);
  assert.deepEqual(organizationRoleStatements[ORG_ROLE.STUDENT].messaging, [
    "read",
    "send",
  ]);
});

test("élèves et parents ne créent pas de groupes", () => {
  assert.equal(canCreateGroup({ memberRole: ORG_ROLE.STUDENT }), false);
  assert.equal(canCreateGroup({ memberRole: ORG_ROLE.PARENT }), false);
  assert.equal(canCreateGroup({ memberRole: ORG_ROLE.TEACHER }), true);
});

test("NOTIFY_KLAMBO_APP_FIRST défaut = activé", () => {
  const prev = process.env.NOTIFY_KLAMBO_APP_FIRST;
  delete process.env.NOTIFY_KLAMBO_APP_FIRST;
  const raw = process.env.NOTIFY_KLAMBO_APP_FIRST?.trim().toLowerCase();
  const enabled = !(
    raw === "0" ||
    raw === "false" ||
    raw === "off" ||
    raw === "no"
  );
  assert.equal(enabled, true);
  if (prev !== undefined) process.env.NOTIFY_KLAMBO_APP_FIRST = prev;
});

console.log("\ndeliverSchoolNotify prerequisites — OK");
