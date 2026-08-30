/**
 * Messagerie — politique V1 (sans base).
 * Run: pnpm exec tsx scripts/test-messaging-policy.ts
 */
import assert from "node:assert/strict";
import { APP_ROLE, ORG_ROLE } from "../lib/permissions";
import {
  canCreateGroup,
  canPurgeOrganizationMessaging,
  canSendMessages,
  canUseMessaging,
  isEligibleMessagingRecipient,
  isMessagingEligibleRole,
} from "../lib/messaging/messaging-policy";
import { sanitizeMessageBody } from "../lib/messaging/messaging-types";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("élèves et parents exclus de la messagerie V1", () => {
  assert.equal(isMessagingEligibleRole(ORG_ROLE.STUDENT), false);
  assert.equal(isMessagingEligibleRole(ORG_ROLE.PARENT), false);
  assert.equal(
    canUseMessaging({ memberRole: ORG_ROLE.STUDENT, appRole: APP_ROLE.USER }),
    false,
  );
  assert.equal(
    canUseMessaging({ memberRole: ORG_ROLE.PARENT, appRole: APP_ROLE.USER }),
    false,
  );
});

test("enseignants, direction et personnel peuvent lire et envoyer", () => {
  for (const role of [
    ORG_ROLE.TEACHER,
    ORG_ROLE.DIRECTEUR,
    ORG_ROLE.GESTIONNAIRE,
    ORG_ROLE.CAISSIER,
    ORG_ROLE.OWNER,
  ]) {
    assert.equal(canUseMessaging({ memberRole: role }), true, role);
    assert.equal(canSendMessages({ memberRole: role }), true, role);
    assert.equal(canCreateGroup({ memberRole: role }), true, role);
  }
});

test("isolation : un membre archivé ou banni ne peut pas envoyer", () => {
  assert.equal(
    canUseMessaging({
      memberRole: ORG_ROLE.TEACHER,
      memberArchived: true,
    }),
    false,
  );
  assert.equal(
    canUseMessaging({
      memberRole: ORG_ROLE.TEACHER,
      userBanned: true,
    }),
    false,
  );
  assert.equal(
    isEligibleMessagingRecipient({
      memberRole: ORG_ROLE.TEACHER,
      memberArchived: true,
    }),
    false,
  );
});

test("seul le propriétaire peut nettoyer", () => {
  assert.equal(
    canPurgeOrganizationMessaging({ memberRole: ORG_ROLE.OWNER }),
    true,
  );
  assert.equal(
    canPurgeOrganizationMessaging({ appRole: APP_ROLE.OWNER }),
    true,
  );
  assert.equal(
    canPurgeOrganizationMessaging({ memberRole: ORG_ROLE.GESTIONNAIRE }),
    false,
  );
  assert.equal(
    canPurgeOrganizationMessaging({ memberRole: ORG_ROLE.TEACHER }),
    false,
  );
  assert.equal(
    canPurgeOrganizationMessaging({ memberRole: ORG_ROLE.DIRECTEUR }),
    false,
  );
});

test("le HTML est retiré du corps de message", () => {
  assert.equal(sanitizeMessageBody("  <script>x</script> Bonjour  "), "Bonjour");
  assert.equal(sanitizeMessageBody("<b>ok</b>"), "ok");
});

test("rôles Better Auth member/admin et rôle vide sont éligibles", () => {
  assert.equal(isMessagingEligibleRole("member"), true);
  assert.equal(isMessagingEligibleRole("admin"), true);
  assert.equal(isMessagingEligibleRole(""), true);
  assert.equal(isMessagingEligibleRole("teacher", ["STUDENT"]), true);
});

test("owner plateforme contourne le rôle membre", () => {
  assert.equal(
    canUseMessaging({
      appRole: APP_ROLE.OWNER,
      memberRole: null,
    }),
    true,
  );
});

test("organisation avec messagerie désactivée : aucun accès", () => {
  assert.equal(
    canUseMessaging({
      memberRole: ORG_ROLE.TEACHER,
      organizationMessagingEnabled: false,
    }),
    false,
  );
  assert.equal(
    canSendMessages({
      memberRole: ORG_ROLE.OWNER,
      organizationMessagingEnabled: false,
    }),
    false,
  );
  assert.equal(
    canCreateGroup({
      memberRole: ORG_ROLE.OWNER,
      organizationMessagingEnabled: false,
    }),
    false,
  );
  assert.equal(
    canUseMessaging({
      appRole: APP_ROLE.OWNER,
      organizationMessagingEnabled: false,
    }),
    false,
  );
});

console.log("\nAll messaging policy tests passed.");
