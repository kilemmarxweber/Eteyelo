import assert from "node:assert/strict";

import {
  canCreateOrganization,
  canDeleteOrganization,
  canDeleteSpecificOrganization,
  canListAllOrganizations,
  canManageOrganizationAsAppAdmin,
} from "../lib/auth/organization-access";
import { isOrganizationOwnerMember } from "../lib/auth/role-labels";
import { isOrganizationManagerMember } from "../lib/auth/require-organization-permission";
import { buildOrganizationsApiPayload } from "../lib/auth/post-login-routing";
import {
  APP_ROLE,
  ORG_ROLE,
  isAppAdminRole,
  isOrganizationManagerAppRole,
  isPlatformOwnerRole,
  isPlatformSupportAppRole,
  organizationRoleStatements,
} from "../lib/permissions";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("isPlatformOwnerRole detecte uniquement owner", () => {
  assert.equal(isPlatformOwnerRole(APP_ROLE.OWNER), true);
  assert.equal(isPlatformOwnerRole(APP_ROLE.ADMIN), false);
  assert.equal(isPlatformOwnerRole(APP_ROLE.USER), false);
  assert.equal(isPlatformOwnerRole(null), false);
});

test("isAppAdminRole detecte uniquement admin", () => {
  assert.equal(isAppAdminRole(APP_ROLE.ADMIN), true);
  assert.equal(isAppAdminRole(APP_ROLE.OWNER), false);
});

test("isPlatformSupportAppRole detecte platform_support", () => {
  assert.equal(isPlatformSupportAppRole(APP_ROLE.PLATFORM_SUPPORT), true);
  assert.equal(isPlatformSupportAppRole(APP_ROLE.USER), false);
});

test("isOrganizationManagerAppRole inclut owner et admin", () => {
  assert.equal(isOrganizationManagerAppRole(APP_ROLE.OWNER), true);
  assert.equal(isOrganizationManagerAppRole(APP_ROLE.ADMIN), true);
  assert.equal(isOrganizationManagerAppRole(APP_ROLE.USER), false);
});

test("canListAllOrganizations reserve la liste globale au owner", () => {
  assert.equal(canListAllOrganizations(APP_ROLE.OWNER), true);
  assert.equal(canListAllOrganizations(APP_ROLE.ADMIN), false);
  assert.equal(canListAllOrganizations(APP_ROLE.USER), false);
});

test("canCreateOrganization reserve la creation au owner", () => {
  assert.equal(canCreateOrganization(APP_ROLE.OWNER), true);
  assert.equal(canCreateOrganization(APP_ROLE.ADMIN), false);
});

test("canDeleteOrganization autorise owner plateforme et owner org", () => {
  assert.equal(canDeleteOrganization(APP_ROLE.OWNER), true);
  assert.equal(canDeleteOrganization(APP_ROLE.ADMIN, ORG_ROLE.GESTIONNAIRE), false);
  assert.equal(canDeleteOrganization(APP_ROLE.USER, ORG_ROLE.OWNER), true);
});

test("canDeleteSpecificOrganization verifie l'appartenance org", () => {
  assert.equal(
    canDeleteSpecificOrganization(APP_ROLE.USER, "org-a", {
      organizationId: "org-b",
      role: ORG_ROLE.OWNER,
    }),
    false,
  );
  assert.equal(
    canDeleteSpecificOrganization(APP_ROLE.USER, "org-a", {
      organizationId: "org-a",
      role: ORG_ROLE.OWNER,
    }),
    true,
  );
});

test("canManageOrganizationAsAppAdmin cible le role admin", () => {
  assert.equal(canManageOrganizationAsAppAdmin(APP_ROLE.ADMIN), true);
  assert.equal(canManageOrganizationAsAppAdmin(APP_ROLE.USER), false);
});

test("isOrganizationOwnerMember detecte owner membre", () => {
  assert.equal(isOrganizationOwnerMember(ORG_ROLE.OWNER), true);
  assert.equal(isOrganizationOwnerMember(ORG_ROLE.GESTIONNAIRE), false);
});

test("isOrganizationManagerMember accepte owner et gestionnaire", () => {
  assert.equal(isOrganizationManagerMember(ORG_ROLE.GESTIONNAIRE), true);
  assert.equal(isOrganizationManagerMember(ORG_ROLE.OWNER), true);
  assert.equal(isOrganizationManagerMember(ORG_ROLE.TEACHER), false);
});

test("matrice gestionnaire sans delete organisation", () => {
  const statements = organizationRoleStatements[ORG_ROLE.GESTIONNAIRE];
  assert.ok(statements.organization?.includes("update"));
  assert.equal(statements.organization?.includes("delete"), false);
  assert.ok(statements.member?.includes("create"));
  assert.ok(statements.member?.includes("delete"));
});

test("matrice owner org conserve delete organisation", () => {
  const statements = organizationRoleStatements[ORG_ROLE.OWNER];
  assert.ok(statements.organization?.includes("delete"));
});

test("payload API organisations pour owner plateforme", () => {
  const payload = buildOrganizationsApiPayload({
    organizations: [{ id: "org-1", name: "Demo" }],
    canCreate: true,
    canDelete: true,
    canListAll: true,
    isPlatformOwner: true,
    isOrgManager: false,
    appRole: APP_ROLE.OWNER,
    membershipRole: null,
    membershipOrganizationId: null,
  });

  assert.equal(payload.canCreate, true);
  assert.equal(payload.canListAll, true);
  assert.equal(payload.isPlatformOwner, true);
  assert.equal(payload.membershipRole, null);
});

test("payload API organisations pour gestionnaire org", () => {
  const payload = buildOrganizationsApiPayload({
    organizations: [{ id: "org-1", name: "Demo" }],
    canCreate: false,
    canDelete: false,
    canListAll: false,
    isPlatformOwner: false,
    isOrgManager: true,
    appRole: APP_ROLE.ADMIN,
    membershipRole: ORG_ROLE.GESTIONNAIRE,
    membershipOrganizationId: "org-1",
  });

  assert.equal(payload.canCreate, false);
  assert.equal(payload.isOrgManager, true);
  assert.equal(payload.membershipRole, ORG_ROLE.GESTIONNAIRE);
});

console.log("\nTous les tests permissions organisations sont passes.");
