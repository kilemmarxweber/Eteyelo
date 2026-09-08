import assert from "node:assert/strict";

import {
  canUseOrganizationBranchesList,
  resolveBranchesNavHref,
} from "../lib/auth/branches-nav";
import { APP_ROLE, ORG_ROLE } from "../lib/permissions";
import { getOrganizationAccessRoleLabel } from "../lib/auth/role-labels";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

const ORG_ID = "org_eteyelo_demo";

test("proprietaire plateforme → liste des branches", () => {
  assert.equal(
    canUseOrganizationBranchesList({ user: { role: APP_ROLE.OWNER } }),
    true,
  );
  assert.equal(
    resolveBranchesNavHref({
      organizationId: ORG_ID,
      useBranchesList: true,
      accessibleBranchCount: 0,
    }),
    `/admin/organizations/${ORG_ID}/branches`,
  );
});

test("proprietaire organisation → liste des branches", () => {
  assert.equal(
    canUseOrganizationBranchesList({
      user: { role: APP_ROLE.USER },
      organization: { role: ORG_ROLE.OWNER },
    }),
    true,
  );
});

test("admin user + proprietaire org → liste des branches de l'organisation", () => {
  assert.equal(
    canUseOrganizationBranchesList({
      user: { role: APP_ROLE.ADMIN },
      organization: { role: `${ORG_ROLE.OWNER},${ORG_ROLE.TEACHER}` },
    }),
    true,
  );
  assert.equal(
    canUseOrganizationBranchesList({
      user: { role: APP_ROLE.ADMIN },
      organization: { role: ORG_ROLE.GESTIONNAIRE },
    }),
    true,
  );
  assert.equal(
    getOrganizationAccessRoleLabel(
      APP_ROLE.ADMIN,
      `${ORG_ROLE.OWNER},${ORG_ROLE.TEACHER}`,
    ),
    "Propriétaire",
  );
});

test("enseignant / parent / caissier multi-branches → branch-picker", () => {
  for (const role of [ORG_ROLE.TEACHER, ORG_ROLE.PARENT, ORG_ROLE.CAISSIER]) {
    assert.equal(
      canUseOrganizationBranchesList({
        user: { role: APP_ROLE.USER },
        organization: { role },
      }),
      false,
      role,
    );
  }
  assert.equal(
    resolveBranchesNavHref({
      organizationId: ORG_ID,
      useBranchesList: false,
      accessibleBranchCount: 2,
    }),
    `/admin/organizations/${ORG_ID}/branch-picker`,
  );
});

test("une seule branche : pas de lien navbar", () => {
  assert.equal(
    resolveBranchesNavHref({
      organizationId: ORG_ID,
      useBranchesList: false,
      accessibleBranchCount: 1,
    }),
    null,
  );
});

console.log("\nTous les tests branches-nav sont passes.");
