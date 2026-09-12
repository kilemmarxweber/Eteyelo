import assert from "node:assert/strict";

import { orgRoleToBranchRole } from "../lib/auth/org-role-to-branch-role";
import { ORG_ROLE } from "../lib/permissions";
import { BranchRole } from "../prisma/generated/prisma/enums";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("agent de bureau seul → personnel (ADMIN), sans enseignant", () => {
  assert.equal(orgRoleToBranchRole(ORG_ROLE.AGENT_BUREAU), BranchRole.ADMIN);
});

test("dual enseignant + bureau conserve le profil enseignant", () => {
  assert.equal(
    orgRoleToBranchRole(`${ORG_ROLE.AGENT_BUREAU},${ORG_ROLE.TEACHER}`),
    BranchRole.TEACHER,
  );
});

test("enseignant / caissier / directeur inchangés", () => {
  assert.equal(orgRoleToBranchRole(ORG_ROLE.TEACHER), BranchRole.TEACHER);
  assert.equal(orgRoleToBranchRole(ORG_ROLE.CAISSIER), BranchRole.CAISSIER);
  assert.equal(orgRoleToBranchRole(ORG_ROLE.DIRECTEUR), BranchRole.DIRECTOR);
});

console.log("\nTous les tests org-role-to-branch-role sont passes.");
