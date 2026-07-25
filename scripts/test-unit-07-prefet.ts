/**
 * Smoke tests — unit-07 périmètre directeur des études (pédagogie, pas finance).
 * Note : `prefet` / `directeur` sont unifiés (chef établissement + finance).
 * L’ancien périmètre « préfet sans finance » est porté par `directeur_etudes`.
 */
import assert from "node:assert/strict";

import {
  getDashboardDataBlocks,
  resolveDashboardVariant,
} from "../lib/auth/dashboard-variant";
import { resolveMembershipPostLoginPath } from "../lib/auth/post-login-routing";
import {
  canAccessFinanceArea,
  canAccessPedagogyArea,
  canAccessResultsArea,
  canAccessTeachingArea,
  canManageHrDirectory,
  canManageOrganization,
  canManageParentRecords,
  canManagePersonnelRecords,
  isDirecteurEtudesRole,
  isSchoolLeadershipRole,
} from "../lib/auth/session-roles";
import { ORG_ROLE, organizationRoleStatements } from "../lib/permissions";
import { buildStaticSideLinks } from "../lib/sidebar-menu";

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

const sessionEtudes = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);
const sessionDirecteur = sessionWithOrgRole(ORG_ROLE.DIRECTEUR);
const sessionPrefet = sessionWithOrgRole(ORG_ROLE.PREFET);
const sessionCaissier = sessionWithOrgRole(ORG_ROLE.CAISSIER);
const sessionTeacher = sessionWithOrgRole(ORG_ROLE.TEACHER);

test("directeur des études : pedagogy / manage oui ; finance non", () => {
  assert.equal(canManageOrganization(sessionEtudes), true);
  assert.equal(canAccessPedagogyArea(sessionEtudes), true);
  assert.equal(canAccessTeachingArea(sessionEtudes), true);
  assert.equal(canAccessResultsArea(sessionEtudes), true);
  assert.equal(isDirecteurEtudesRole(sessionEtudes), true);
  assert.equal(isSchoolLeadershipRole(sessionEtudes), false);
  assert.equal(canAccessFinanceArea(sessionEtudes), false);
});

test("URL finance refusée via canAccessFinanceArea (études)", () => {
  assert.equal(canAccessFinanceArea(sessionEtudes), false);
  assert.equal(canAccessFinanceArea(sessionDirecteur), true);
  assert.equal(canAccessFinanceArea(sessionPrefet), true);
  assert.equal(canAccessFinanceArea(sessionCaissier), true);
});

test("menu études : pédagogie complète, sans Finance", () => {
  const links = buildStaticSideLinks(sessionEtudes, BRANCH_PATH, "PRIMAIRE");
  const titles = links.map((item) => item.title);
  const cursus = (
    links.find((item) => item.title === "Cursus")?.sub ?? []
  ).map((item) => item.title);
  const enseignement = (
    links.find((item) => item.title === "Enseignement")?.sub ?? []
  ).map((item) => item.title);
  const utilisateurs = (
    links.find((item) => item.title === "Utilisateurs")?.sub ?? []
  ).map((item) => item.title);

  assert.ok(titles.includes("Dashboard"));
  assert.ok(titles.includes("Inscription"));
  assert.ok(titles.includes("Presences"));
  assert.ok(titles.includes("Candidatures"));
  assert.ok(titles.includes("Utilisateurs"));
  assert.ok(titles.includes("Enseignement"));
  assert.ok(titles.includes("Classes"));
  assert.ok(titles.includes("Cursus"));
  assert.ok(!titles.includes("Finance"), "études ne doit pas voir Finance");

  assert.ok(enseignement.includes("Cours"));
  assert.ok(enseignement.includes("Affectations"));
  assert.ok(enseignement.includes("Horaire"));

  assert.ok(cursus.includes("Notes"));
  assert.ok(cursus.includes("Résultats"));
  assert.ok(cursus.includes("Bibliothèque"));
  assert.ok(cursus.includes("Fiches"));

  assert.ok(utilisateurs.includes("Élève"));
  assert.ok(utilisateurs.includes("Personnel"));
  assert.ok(utilisateurs.includes("Enseignant"));
  assert.ok(utilisateurs.includes("Parent"));
});

test("distinct caissier / enseignant", () => {
  const caissierTitles = buildStaticSideLinks(
    sessionCaissier,
    BRANCH_PATH,
    "PRIMAIRE",
  ).map((item) => item.title);
  assert.ok(caissierTitles.includes("Finance"));
  assert.ok(!caissierTitles.includes("Inscription"));
  assert.ok(!caissierTitles.includes("Classes"));
  assert.ok(!caissierTitles.includes("Enseignement"));

  const teacherTitles = buildStaticSideLinks(
    sessionTeacher,
    BRANCH_PATH,
    "PRIMAIRE",
  ).map((item) => item.title);
  assert.ok(!teacherTitles.includes("Finance"));
  assert.ok(!teacherTitles.includes("Inscription"));
  assert.ok(!teacherTitles.includes("Classes"));
  assert.ok(teacherTitles.includes("Enseignement"));

  assert.equal(canAccessPedagogyArea(sessionCaissier), false);
  assert.equal(canAccessPedagogyArea(sessionTeacher), false);
});

test("dashboard = variante études (pas revenus)", () => {
  assert.equal(resolveDashboardVariant(sessionEtudes), "directeur_etudes");
  assert.notEqual(resolveDashboardVariant(sessionEtudes), "directeur");
  assert.notEqual(resolveDashboardVariant(sessionEtudes), "caissier");

  const blocks = getDashboardDataBlocks("directeur_etudes");
  assert.equal(blocks.schoolStats, true);
  assert.equal(blocks.pedagogyMetrics, true);
  assert.equal(blocks.revenue, false);
  assert.equal(blocks.cashier, false);
});

test("chef établissement distinct : finance + dashboard revenus", () => {
  assert.equal(resolveDashboardVariant(sessionDirecteur), "directeur");
  assert.equal(resolveDashboardVariant(sessionPrefet), "directeur");
  assert.equal(canAccessFinanceArea(sessionDirecteur), true);
  assert.equal(canAccessFinanceArea(sessionPrefet), true);
  for (const session of [sessionDirecteur, sessionPrefet]) {
    const titles = buildStaticSideLinks(
      session,
      BRANCH_PATH,
      "PRIMAIRE",
    ).map((item) => item.title);
    assert.ok(titles.includes("Finance"));
  }
});

test("HR : études lecture seule personnel / parents ; chef école CRUD", () => {
  assert.equal(canManageHrDirectory(sessionEtudes), false);
  assert.equal(canManagePersonnelRecords(sessionEtudes), false);
  assert.equal(canManageParentRecords(sessionEtudes), false);
  assert.equal(canManagePersonnelRecords(sessionDirecteur), true);
  assert.equal(canManageParentRecords(sessionPrefet), true);
  assert.equal(canManageHrDirectory(sessionTeacher), false);
  assert.equal(canManageHrDirectory(sessionCaissier), false);
});

test("AC Better Auth : études personnel/parent read ; pas invitation org", () => {
  const statements = organizationRoleStatements[ORG_ROLE.DIRECTEUR_ETUDES];
  assert.deepEqual(statements.personnel, ["read"]);
  assert.deepEqual(statements.parent, ["read"]);
  assert.ok(statements.teacher?.includes("create"));
  assert.ok(statements.schedule?.includes("update"));
  assert.ok(statements.inscription?.includes("create"));
  assert.equal(statements.invitation, undefined);
  assert.equal(statements.organization?.includes("update") ?? false, false);

  const chef = organizationRoleStatements[ORG_ROLE.DIRECTEUR];
  assert.ok(chef.personnel?.includes("create"));
  assert.deepEqual(
    organizationRoleStatements[ORG_ROLE.PREFET].personnel,
    chef.personnel,
  );
});

test("post-login études → /ecodim", () => {
  const path = resolveMembershipPostLoginPath({
    organizationId: "org-test",
    membershipRole: ORG_ROLE.DIRECTEUR_ETUDES,
  });
  assert.equal(path, "/admin/organizations/org-test/ecodim");
});

console.log("\nAll unit-07 directeur des études smoke tests passed.");
