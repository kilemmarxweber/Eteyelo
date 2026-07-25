/**
 * Smoke tests — unit-08 chef d’établissement (`directeur` ↔ `prefet`).
 * Même permissions (pédagogie + finance) ; libellé selon type d’école.
 */
import assert from "node:assert/strict";

import {
  canAccessOrganizationOwnerSections,
  canAccessOrganizationPartenaires,
  canArchiveOrganization,
  canCreateOrganization,
  canDeleteOrganization,
} from "../lib/auth/organization-access";
import { canAccessOrganizationAdminHome } from "../lib/auth/organization-admin-home";
import {
  getDashboardDataBlocks,
  resolveDashboardVariant,
} from "../lib/auth/dashboard-variant";
import { resolveMembershipPostLoginPath } from "../lib/auth/post-login-routing";
import { isOrganizationManagerMember } from "../lib/auth/require-organization-permission";
import {
  canAccessBranchOrgSettings,
  canAccessFinanceArea,
  canAccessPedagogyArea,
  canAccessResultsArea,
  canAccessTeachingArea,
  canDeleteOrganizationResource,
  canManageHrDirectory,
  canManageOrganization,
  isOrganizationOwnerSession,
  isSchoolLeadershipRole,
} from "../lib/auth/session-roles";
import {
  APP_ROLE,
  ORG_ROLE,
  organizationRoleStatements,
} from "../lib/permissions";
import { orgRoleLabel, schoolHeadRoleLabel } from "../lib/org-role-labels";
import {
  OWNER_ONLY_MENU_ROLES,
  buildStaticSideLinks,
} from "../lib/sidebar-menu";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function sessionWithOrgRole(
  role: string,
  extras: Record<string, unknown> = {},
) {
  return {
    organization: { role },
    branch: { typebranch: "PRIMAIRE" },
    ...extras,
  };
}

const BRANCH_PATH =
  "/admin/organizations/org-test/branches/branch-primaire";

const sessionDirecteur = sessionWithOrgRole(ORG_ROLE.DIRECTEUR);
const sessionPrefet = sessionWithOrgRole(ORG_ROLE.PREFET);
const sessionEtudes = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);
const sessionCaissier = sessionWithOrgRole(ORG_ROLE.CAISSIER);
const sessionTeacher = sessionWithOrgRole(ORG_ROLE.TEACHER);
const sessionGestionnaire = sessionWithOrgRole(ORG_ROLE.GESTIONNAIRE);

test("prefet ≡ directeur : pedagogy + finance + manage + HR write", () => {
  for (const session of [sessionDirecteur, sessionPrefet]) {
    assert.equal(canManageOrganization(session), true);
    assert.equal(canAccessPedagogyArea(session), true);
    assert.equal(canAccessTeachingArea(session), true);
    assert.equal(canAccessResultsArea(session), true);
    assert.equal(canAccessFinanceArea(session), true);
    assert.equal(isSchoolLeadershipRole(session), true);
    assert.equal(canManageHrDirectory(session), true);
  }
});

test("menu chef établissement = pédagogie + Finance", () => {
  for (const session of [sessionDirecteur, sessionPrefet]) {
    const links = buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE");
    const titles = links.map((item) => item.title);
    assert.ok(titles.includes("Finance"), "chef école doit voir Finance");
    assert.ok(titles.includes("Enseignement"));
    assert.ok(titles.includes("Classes"));
    assert.ok(titles.includes("Cursus"));
  }
});

test("libellés contextuels : primaire Directeur, secondaire Préfet", () => {
  assert.equal(schoolHeadRoleLabel("PRIMAIRE"), "Directeur");
  assert.equal(schoolHeadRoleLabel("SECONDAIRE"), "Préfet");
  assert.equal(
    orgRoleLabel(ORG_ROLE.DIRECTEUR, { typebranch: "SECONDAIRE" }),
    "Préfet",
  );
  assert.equal(
    orgRoleLabel(ORG_ROLE.PREFET, { typebranch: "PRIMAIRE" }),
    "Directeur",
  );
  assert.equal(orgRoleLabel(ORG_ROLE.DIRECTEUR_ETUDES), "Directeur des études");
});

test("pas d’accès owner-only (partenaires, delete org, settings org)", () => {
  assert.ok(!OWNER_ONLY_MENU_ROLES.includes(ORG_ROLE.DIRECTEUR));
  assert.ok(!OWNER_ONLY_MENU_ROLES.includes(ORG_ROLE.PREFET));
  assert.deepEqual(OWNER_ONLY_MENU_ROLES, [APP_ROLE.OWNER, ORG_ROLE.OWNER]);

  assert.equal(canDeleteOrganization(APP_ROLE.USER, ORG_ROLE.DIRECTEUR), false);
  assert.equal(canDeleteOrganizationResource(sessionDirecteur), false);
  assert.equal(canArchiveOrganization(APP_ROLE.USER, ORG_ROLE.PREFET), false);
  assert.equal(canCreateOrganization(APP_ROLE.USER), false);
  assert.equal(
    canAccessOrganizationPartenaires(APP_ROLE.USER, ORG_ROLE.DIRECTEUR),
    false,
  );
  assert.equal(
    canAccessOrganizationOwnerSections(APP_ROLE.USER, ORG_ROLE.PREFET),
    false,
  );
  assert.equal(canAccessBranchOrgSettings(sessionDirecteur), false);
  assert.equal(isOrganizationOwnerSession(sessionPrefet), false);
});

test("distinct du directeur des études : finance + revenus + HR write", () => {
  assert.equal(canAccessFinanceArea(sessionDirecteur), true);
  assert.equal(canAccessFinanceArea(sessionEtudes), false);
  assert.equal(canManageHrDirectory(sessionPrefet), true);
  assert.equal(canManageHrDirectory(sessionEtudes), false);

  assert.equal(resolveDashboardVariant(sessionDirecteur), "directeur");
  assert.equal(resolveDashboardVariant(sessionPrefet), "directeur");
  assert.equal(resolveDashboardVariant(sessionEtudes), "directeur_etudes");

  const dirBlocks = getDashboardDataBlocks("directeur");
  assert.equal(dirBlocks.revenue, true);

  const etudesBlocks = getDashboardDataBlocks("directeur_etudes");
  assert.equal(etudesBlocks.revenue, false);

  const etudesTitles = buildStaticSideLinks(
    sessionEtudes,
    BRANCH_PATH,
    "PRIMAIRE",
  ).map((item) => item.title);
  assert.ok(!etudesTitles.includes("Finance"));
});

test("distinct du caissier : classes / notes / pédagogie", () => {
  const dirTitles = buildStaticSideLinks(
    sessionDirecteur,
    BRANCH_PATH,
    "PRIMAIRE",
  ).map((item) => item.title);
  const caissierTitles = buildStaticSideLinks(
    sessionCaissier,
    BRANCH_PATH,
    "PRIMAIRE",
  ).map((item) => item.title);

  assert.ok(dirTitles.includes("Classes"));
  assert.ok(dirTitles.includes("Enseignement"));
  assert.ok(caissierTitles.includes("Finance"));
  assert.ok(!caissierTitles.includes("Classes"));
  assert.equal(canAccessPedagogyArea(sessionCaissier), false);
  assert.equal(canAccessFinanceArea(sessionTeacher), false);
});

test("hub org OK ; post-login → /ecodim", () => {
  assert.equal(isOrganizationManagerMember(ORG_ROLE.DIRECTEUR), true);
  assert.equal(isOrganizationManagerMember(ORG_ROLE.PREFET), true);
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.DIRECTEUR), true);

  for (const role of [ORG_ROLE.DIRECTEUR, ORG_ROLE.PREFET] as const) {
    const path = resolveMembershipPostLoginPath({
      organizationId: "org-test",
      membershipRole: role,
    });
    assert.equal(path, "/admin/organizations/org-test/ecodim");
  }

  const gestionnairePath = resolveMembershipPostLoginPath({
    organizationId: "org-test",
    membershipRole: ORG_ROLE.GESTIONNAIRE,
  });
  assert.equal(gestionnairePath, "/admin/organizations/org-test");
  assert.equal(canManageOrganization(sessionGestionnaire), true);
});

test("AC Better Auth : CRU métier identique prefet/directeur", () => {
  const directeur = organizationRoleStatements[ORG_ROLE.DIRECTEUR];
  const prefet = organizationRoleStatements[ORG_ROLE.PREFET];
  assert.deepEqual(directeur.member, prefet.member);
  assert.deepEqual(directeur.personnel, prefet.personnel);
  assert.deepEqual(directeur.parent, prefet.parent);
  assert.equal(directeur.invitation, undefined);
  assert.equal(prefet.invitation, undefined);
  assert.equal(directeur.organization?.includes("update") ?? false, false);
});

console.log("\nAll unit-08 chef établissement smoke tests passed.");
