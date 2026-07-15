import assert from "node:assert/strict";

import {
  resolveAppAdminPostLoginPath,
  resolveMembershipPostLoginPath,
  resolveStaticAppRolePostLoginPath,
} from "../lib/auth/post-login-routing";
import { APP_ROLE, ORG_ROLE } from "../lib/permissions";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

const ORG_ID = "org_eteyelo_demo";
const BRANCH_ID = "branch_demo_1";

test("owner plateforme route vers /admin", () => {
  assert.equal(resolveStaticAppRolePostLoginPath(APP_ROLE.OWNER), "/admin");
});

test("support plateforme route vers /admin/platform-support", () => {
  assert.equal(
    resolveStaticAppRolePostLoginPath(APP_ROLE.PLATFORM_SUPPORT),
    "/admin/platform-support",
  );
});

test("roles non statiques retournent null", () => {
  assert.equal(resolveStaticAppRolePostLoginPath(APP_ROLE.ADMIN), null);
  assert.equal(resolveStaticAppRolePostLoginPath(APP_ROLE.USER), null);
});

test("admin avec org route vers la page organisation", () => {
  assert.equal(
    resolveAppAdminPostLoginPath(ORG_ID),
    `/admin/organizations/${ORG_ID}`,
  );
});

test("admin sans org retombe sur /admin", () => {
  assert.equal(resolveAppAdminPostLoginPath(null), "/admin");
});

test("enseignant route vers sa branche", () => {
  assert.equal(
    resolveMembershipPostLoginPath({
      organizationId: ORG_ID,
      membershipRole: ORG_ROLE.TEACHER,
      branchId: BRANCH_ID,
      branchCount: 1,
    }),
    `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}`,
  );
});

test("parent route vers sa branche", () => {
  assert.equal(
    resolveMembershipPostLoginPath({
      organizationId: ORG_ID,
      membershipRole: ORG_ROLE.PARENT,
      branchId: BRANCH_ID,
      branchCount: 1,
    }),
    `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}`,
  );
});

test("eleve route vers sa branche", () => {
  assert.equal(
    resolveMembershipPostLoginPath({
      organizationId: ORG_ID,
      membershipRole: ORG_ROLE.STUDENT,
      branchId: BRANCH_ID,
      branchCount: 1,
    }),
    `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}`,
  );
});

test("multi-branches sans preference route vers branch-picker", () => {
  assert.equal(
    resolveMembershipPostLoginPath({
      organizationId: ORG_ID,
      membershipRole: ORG_ROLE.PARENT,
      branchCount: 2,
    }),
    `/admin/organizations/${ORG_ID}/branch-picker`,
  );
});

test("roles ecodim route vers /ecodim", () => {
  assert.equal(
    resolveMembershipPostLoginPath({
      organizationId: ORG_ID,
      membershipRole: ORG_ROLE.RESPONSABLE,
      branchCount: 0,
    }),
    `/admin/organizations/${ORG_ID}/ecodim`,
  );
});

test("gestionnaire org route vers accueil organisation", () => {
  assert.equal(
    resolveMembershipPostLoginPath({
      organizationId: ORG_ID,
      membershipRole: ORG_ROLE.GESTIONNAIRE,
      branchCount: 0,
    }),
    `/admin/organizations/${ORG_ID}`,
  );
});

console.log("\nTous les tests routage post-login sont passes.");
