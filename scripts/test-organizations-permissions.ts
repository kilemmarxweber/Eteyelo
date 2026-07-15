import assert from "node:assert/strict";

import {
  canAccessOrganizationOwnerSections,
  canAccessOrganizationOwnerSectionsForOrg,
  canAccessOrganizationPartenaires,
  canAccessOrganizationPartenairesForOrg,
  canArchiveOrganization,
  canArchiveSpecificOrganization,
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
  applicationRoleStatements,
  isAppAdminRole,
  isOrganizationManagerAppRole,
  isPlatformOwnerRole,
  isPlatformSupportAppRole,
  organizationRoleStatements,
} from "../lib/permissions";
import { isOrganizationOwnerSession } from "../lib/auth/session-roles";
import { OWNER_ONLY_MENU_ROLES } from "../lib/sidebar-menu";

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

test("canDeleteOrganization reserve la suppression au owner plateforme", () => {
  assert.equal(canDeleteOrganization(APP_ROLE.OWNER), true);
  assert.equal(canDeleteOrganization(APP_ROLE.ADMIN, ORG_ROLE.GESTIONNAIRE), false);
  assert.equal(canDeleteOrganization(APP_ROLE.USER, ORG_ROLE.OWNER), false);
});

test("canArchiveOrganization autorise owner plateforme et proprietaire org", () => {
  assert.equal(canArchiveOrganization(APP_ROLE.OWNER), true);
  assert.equal(canArchiveOrganization(APP_ROLE.USER, ORG_ROLE.OWNER), true);
  assert.equal(
    canArchiveOrganization(APP_ROLE.ADMIN, ORG_ROLE.GESTIONNAIRE),
    false,
  );
  assert.equal(canArchiveOrganization(APP_ROLE.USER, ORG_ROLE.GESTIONNAIRE), false);
});

test("canAccessOrganizationOwnerSections reserve aux owners", () => {
  assert.equal(canAccessOrganizationOwnerSections(APP_ROLE.OWNER), true);
  assert.equal(
    canAccessOrganizationOwnerSections(APP_ROLE.USER, ORG_ROLE.OWNER),
    true,
  );
  assert.equal(
    canAccessOrganizationOwnerSections(APP_ROLE.ADMIN, ORG_ROLE.GESTIONNAIRE),
    false,
  );
  assert.equal(
    canAccessOrganizationOwnerSections(APP_ROLE.USER, ORG_ROLE.GESTIONNAIRE),
    false,
  );
  assert.equal(
    canAccessOrganizationOwnerSections(APP_ROLE.USER, ORG_ROLE.CAISSIER),
    false,
  );
  assert.equal(
    canAccessOrganizationOwnerSections(APP_ROLE.USER, ORG_ROLE.PREFET),
    false,
  );
});

test("canAccessOrganizationPartenaires reserve au owner plateforme", () => {
  assert.equal(canAccessOrganizationPartenaires(APP_ROLE.OWNER), true);
  assert.equal(canAccessOrganizationPartenaires(APP_ROLE.ADMIN), false);
  assert.equal(
    canAccessOrganizationPartenaires(APP_ROLE.USER, ORG_ROLE.OWNER),
    false,
  );
  assert.equal(
    canAccessOrganizationPartenaires(APP_ROLE.USER, ORG_ROLE.GESTIONNAIRE),
    false,
  );
});

test("canAccessOrganizationOwnerSectionsForOrg scope le membership a l'org", () => {
  assert.equal(
    canAccessOrganizationOwnerSectionsForOrg(APP_ROLE.OWNER, "org-a", null),
    true,
  );
  assert.equal(
    canAccessOrganizationOwnerSectionsForOrg(APP_ROLE.USER, "org-a", {
      organizationId: "org-a",
      role: ORG_ROLE.OWNER,
    }),
    true,
  );
  assert.equal(
    canAccessOrganizationOwnerSectionsForOrg(APP_ROLE.USER, "org-a", {
      organizationId: "org-b",
      role: ORG_ROLE.OWNER,
    }),
    false,
  );
  assert.equal(
    canAccessOrganizationOwnerSectionsForOrg(APP_ROLE.ADMIN, "org-a", {
      organizationId: "org-a",
      role: ORG_ROLE.GESTIONNAIRE,
    }),
    false,
  );
});

test("canAccessOrganizationPartenairesForOrg reserve au owner plateforme", () => {
  assert.equal(
    canAccessOrganizationPartenairesForOrg(APP_ROLE.OWNER, "org-a", null),
    true,
  );
  assert.equal(
    canAccessOrganizationPartenairesForOrg(APP_ROLE.ADMIN, "org-a", {
      organizationId: "org-a",
      role: ORG_ROLE.GESTIONNAIRE,
    }),
    false,
  );
  assert.equal(
    canAccessOrganizationPartenairesForOrg(APP_ROLE.USER, "org-a", {
      organizationId: "org-a",
      role: ORG_ROLE.OWNER,
    }),
    false,
  );
});

test("isOrganizationOwnerSession detecte owner plateforme ou org", () => {
  assert.equal(
    isOrganizationOwnerSession({ user: { role: APP_ROLE.OWNER } }),
    true,
  );
  assert.equal(
    isOrganizationOwnerSession({
      user: { role: APP_ROLE.USER },
      organization: { role: ORG_ROLE.OWNER },
    }),
    true,
  );
  assert.equal(
    isOrganizationOwnerSession({
      user: { role: APP_ROLE.USER },
      organization: { role: ORG_ROLE.GESTIONNAIRE },
    }),
    false,
  );
});

test("OWNER_ONLY_MENU_ROLES n'inclut pas gestionnaire ni caissier", () => {
  assert.deepEqual(OWNER_ONLY_MENU_ROLES, [APP_ROLE.OWNER, ORG_ROLE.OWNER]);
  const ownerOnly = OWNER_ONLY_MENU_ROLES as readonly string[];
  assert.equal(ownerOnly.includes(ORG_ROLE.GESTIONNAIRE), false);
  assert.equal(ownerOnly.includes(ORG_ROLE.CAISSIER), false);
});

test("canDeleteSpecificOrganization reserve au owner plateforme", () => {
  assert.equal(
    canDeleteSpecificOrganization(APP_ROLE.USER, "org-a", {
      organizationId: "org-a",
      role: ORG_ROLE.OWNER,
    }),
    false,
  );
  assert.equal(
    canDeleteSpecificOrganization(APP_ROLE.OWNER, "org-a", null),
    true,
  );
});

test("canArchiveSpecificOrganization verifie l'appartenance org", () => {
  assert.equal(
    canArchiveSpecificOrganization(APP_ROLE.USER, "org-a", {
      organizationId: "org-b",
      role: ORG_ROLE.OWNER,
    }),
    false,
  );
  assert.equal(
    canArchiveSpecificOrganization(APP_ROLE.USER, "org-a", {
      organizationId: "org-a",
      role: ORG_ROLE.OWNER,
    }),
    true,
  );
  assert.equal(
    canArchiveSpecificOrganization(APP_ROLE.USER, "org-a", {
      organizationId: "org-a",
      role: ORG_ROLE.GESTIONNAIRE,
    }),
    false,
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

test("isOrganizationManagerMember accepte owner gestionnaire et roles CRU", () => {
  assert.equal(isOrganizationManagerMember(ORG_ROLE.GESTIONNAIRE), true);
  assert.equal(isOrganizationManagerMember(ORG_ROLE.OWNER), true);
  assert.equal(isOrganizationManagerMember(ORG_ROLE.PREFET), true);
  assert.equal(isOrganizationManagerMember(ORG_ROLE.DIRECTEUR), true);
  assert.equal(isOrganizationManagerMember(ORG_ROLE.SUPERVISEUR), true);
  assert.equal(isOrganizationManagerMember(ORG_ROLE.TEACHER), false);
});

test("matrice gestionnaire sans delete organisation ni member", () => {
  const statements = organizationRoleStatements[ORG_ROLE.GESTIONNAIRE];
  assert.ok(statements.organization?.includes("update"));
  assert.equal(statements.organization?.includes("delete"), false);
  assert.ok(statements.member?.includes("create"));
  assert.ok(statements.member?.includes("read"));
  assert.ok(statements.member?.includes("update"));
  assert.equal(statements.member?.includes("delete"), false);
});

test("matrice owner org sans delete organisation (archive via update)", () => {
  const statements = organizationRoleStatements[ORG_ROLE.OWNER];
  assert.ok(statements.organization?.includes("update"));
  assert.equal(statements.organization?.includes("delete"), false);
});

test("owner/gestionnaire org ont member:create sans user:create admin", () => {
  // Régression: createOrganizationMemberAction ne doit pas s'appuyer sur
  // auth.api.createUser avec la session du membre (plugin admin → user:create).
  assert.ok(
    organizationRoleStatements[ORG_ROLE.OWNER].member?.includes("create"),
  );
  assert.ok(
    organizationRoleStatements[ORG_ROLE.GESTIONNAIRE].member?.includes(
      "create",
    ),
  );
  assert.equal(
    applicationRoleStatements[APP_ROLE.USER].user?.includes("create") ?? false,
    false,
  );
  assert.ok(
    applicationRoleStatements[APP_ROLE.OWNER].user?.includes("create"),
  );
});

test("nouveaux roles org exposes avec actions 1A", () => {
  assert.deepEqual(
    organizationRoleStatements[ORG_ROLE.PREFET].member,
    ["create", "read", "update"],
  );
  assert.deepEqual(
    organizationRoleStatements[ORG_ROLE.DIRECTEUR].member,
    ["create", "read", "update"],
  );
  assert.deepEqual(
    organizationRoleStatements[ORG_ROLE.SUPERVISEUR].member,
    ["create", "read", "update", "delete"],
  );
  assert.deepEqual(
    organizationRoleStatements[ORG_ROLE.CAISSIER].member,
    ["create", "read", "update"],
  );
  assert.equal(
    organizationRoleStatements[ORG_ROLE.CAISSIER].member?.includes("delete"),
    false,
  );
  assert.equal(
    organizationRoleStatements[ORG_ROLE.CAISSIER].organization?.includes(
      "delete",
    ) ?? false,
    false,
  );
  assert.equal(
    organizationRoleStatements[ORG_ROLE.SUPPORT].platformEscalation?.includes(
      "create",
    ),
    true,
  );
});

test("caissier a member create+update comme owner/gestionnaire (sans delete)", () => {
  for (const role of [
    ORG_ROLE.OWNER,
    ORG_ROLE.GESTIONNAIRE,
    ORG_ROLE.CAISSIER,
  ]) {
    const member = organizationRoleStatements[role].member;
    assert.ok(member?.includes("create"), `${role} member:create`);
    assert.ok(member?.includes("update"), `${role} member:update`);
  }
  assert.equal(
    organizationRoleStatements[ORG_ROLE.CAISSIER].member?.includes("delete"),
    false,
  );
  assert.equal(
    applicationRoleStatements[APP_ROLE.USER].user?.includes("create") ?? false,
    false,
  );
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
