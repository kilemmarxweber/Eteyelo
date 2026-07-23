import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOrganizationInvitationsConfig,
  organizationInvitationsConfigSchema,
} from "../lib/invitations/config";
import { ALL_ORG_ROLE_SLUGS } from "../lib/permissions";

test("config invitations: défauts désactivés", () => {
  const config = parseOrganizationInvitationsConfig(null);
  assert.equal(config.enabled, false);
  assert.equal(config.allowMultiOrg, true);
  assert.equal(config.expiresInDays, 7);
  assert.deepEqual(config.invitableRoles, [...ALL_ORG_ROLE_SLUGS]);
});

test("config invitations: parse metadata org", () => {
  const config = parseOrganizationInvitationsConfig(
    JSON.stringify({
      invitations: {
        enabled: true,
        allowMultiOrg: false,
        expiresInDays: 3,
        invitableRoles: ["gestionnaire", "teacher"],
      },
    }),
  );
  assert.equal(config.enabled, true);
  assert.equal(config.allowMultiOrg, false);
  assert.equal(config.expiresInDays, 3);
  assert.deepEqual(config.invitableRoles, ["gestionnaire", "teacher"]);
});

test("config invitations: ignore rôles inconnus", () => {
  const config = parseOrganizationInvitationsConfig(
    JSON.stringify({
      invitations: {
        enabled: true,
        invitableRoles: ["gestionnaire", "not-a-role"],
      },
    }),
  );
  assert.deepEqual(config.invitableRoles, ["gestionnaire"]);
});

test("config invitations: schema refuse expiresInDays hors bornes", () => {
  const parsed = organizationInvitationsConfigSchema.safeParse({
    expiresInDays: 99,
  });
  assert.equal(parsed.success, false);
});
