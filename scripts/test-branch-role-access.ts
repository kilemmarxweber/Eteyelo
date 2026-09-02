import assert from "node:assert/strict";

import { ORG_ROLE } from "../lib/permissions";
import { isBranchOwnerSession } from "../lib/auth/branch-role-access";
import { isOrganizationOwnerSession } from "../lib/auth/session-roles";
import { canAccessBranchAreaFromPermissions } from "../lib/auth/resolve-branch-area-permission";

function test(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

test("directeur_etudes + branch ADMIN : pas bypass propriétaire branche", () => {
  const session = {
    user: { role: "user" },
    organization: { role: ORG_ROLE.DIRECTEUR_ETUDES },
    branchMemberRole: "ADMIN",
  };

  assert.equal(isBranchOwnerSession(session), false);
  assert.equal(isOrganizationOwnerSession(session), false);
});

test("membre user + branch ADMIN : bypass propriétaire branche", () => {
  const session = {
    user: { role: "user" },
    organization: { role: "user" },
    branchMemberRole: "ADMIN",
  };

  assert.equal(isBranchOwnerSession(session), true);
  assert.equal(isOrganizationOwnerSession(session), true);
});

test("directeur_etudes + branch ADMIN : finance/refus via DAC sans roleStatements owner", () => {
  const session = {
    user: { role: "user" },
    organization: { role: ORG_ROLE.DIRECTEUR_ETUDES },
    branchMemberRole: "ADMIN",
  };
  const emptyMap = new Map();

  assert.equal(
    canAccessBranchAreaFromPermissions("finance", session, emptyMap),
    false,
  );
  assert.equal(
    canAccessBranchAreaFromPermissions("registration", session, emptyMap),
    false,
  );
  assert.equal(
    canAccessBranchAreaFromPermissions("candidatures", session, emptyMap),
    false,
  );
});

console.log("\nAll branch-role-access tests passed.");
