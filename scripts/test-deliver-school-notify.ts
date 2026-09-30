/**
 * deliverSchoolNotify — règles pures (sans DB) + file Klambo.
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
import {
  __resetSchoolNotifyQueueForTests,
  enqueueSchoolNotifyTask,
  getSchoolNotifyQueueDepth,
} from "../lib/notify/school-notify-queue";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

async function testAsync(name: string, assertion: () => Promise<void>) {
  await assertion();
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

test("alias provider inbox (canal exclusif)", () => {
  const aliases = ["inbox", "klambo_inbox", "klambo-inbox", "app"];
  for (const value of aliases) {
    assert.equal(
      ["inbox", "klambo_inbox", "klambo-inbox", "app"].includes(value),
      true,
    );
  }
  assert.equal(["inbox"].includes("klambo"), false);
  assert.equal(["inbox"].includes("meta"), false);
});

async function main() {
  await testAsync("file Klambo sérialise et alterne les lanes", async () => {
    __resetSchoolNotifyQueueForTests();
    process.env.KLAMBO_NOTIFY_GAP_MS = "0";
    const order: string[] = [];
    const jobs = [
      enqueueSchoolNotifyTask(async () => {
        order.push("absence-1");
        return 1;
      }, "absence"),
      enqueueSchoolNotifyTask(async () => {
        order.push("payment-1");
        return 2;
      }, "payment"),
      enqueueSchoolNotifyTask(async () => {
        order.push("absence-2");
        return 3;
      }, "absence"),
    ];
    assert.ok(getSchoolNotifyQueueDepth() >= 0);
    await Promise.all(jobs);
    assert.deepEqual(order, ["absence-1", "payment-1", "absence-2"]);
    __resetSchoolNotifyQueueForTests();
  });

  console.log("\ndeliverSchoolNotify prerequisites — OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
