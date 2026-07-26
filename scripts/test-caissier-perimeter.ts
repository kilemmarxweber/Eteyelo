/**
 * Smoke tests — unit-04 périmètre caissier (finance + inscription).
 */
import assert from "node:assert/strict";

import { canAccessOrganizationAdminHome } from "../lib/auth/organization-admin-home";
import {
  canAccessFinanceArea,
  canAccessRegistrationArea,
  canAccessStudentDirectory,
  canAccessTeachingArea,
  canManageOrganization,
} from "../lib/auth/session-roles";
import { resolveDashboardVariant } from "../lib/auth/dashboard-variant";
import { resolveMembershipPostLoginPath } from "../lib/auth/post-login-routing";
import { ORG_ROLE } from "../lib/permissions";
import { buildStaticSideLinks } from "../lib/sidebar-menu";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function sessionWithOrgRole(role: string) {
  return {
    organization: { role },
    branch: { typebranch: "PRIMAIRE" },
  };
}

const ORG_ID = "org-test";
const BRANCH_ID = "branch-primaire";
const BRANCH_PATH = `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}`;

const sessionCaissier = sessionWithOrgRole(ORG_ROLE.CAISSIER);
const sessionDirecteur = sessionWithOrgRole(ORG_ROLE.DIRECTEUR);
const sessionGestionnaire = sessionWithOrgRole(ORG_ROLE.GESTIONNAIRE);
const sessionTeacher = sessionWithOrgRole(ORG_ROLE.TEACHER);

test("helpers : caissier finance + inscription + lecture élèves oui, manage/teaching non", () => {
  assert.equal(canAccessFinanceArea(sessionCaissier), true);
  assert.equal(canAccessRegistrationArea(sessionCaissier), true);
  assert.equal(canAccessStudentDirectory(sessionCaissier), true);
  assert.equal(canManageOrganization(sessionCaissier), false);
  assert.equal(canAccessTeachingArea(sessionCaissier), false);
});

test("gestionnaire garde la finance ; directeur (chef école) non", () => {
  assert.equal(canAccessFinanceArea(sessionDirecteur), false);
  assert.equal(canAccessFinanceArea(sessionGestionnaire), true);
  assert.equal(canManageOrganization(sessionDirecteur), true);
  assert.equal(canManageOrganization(sessionGestionnaire), true);
});

test("login caissier → land branche", () => {
  assert.equal(
    resolveMembershipPostLoginPath({
      organizationId: ORG_ID,
      membershipRole: ORG_ROLE.CAISSIER,
      branchId: BRANCH_ID,
      branchCount: 1,
    }),
    BRANCH_PATH,
  );
});

test("menu caissier : Dashboard + Inscription + Finance + Utilisateurs/Élève (+ Aide)", () => {
  const links = buildStaticSideLinks(sessionCaissier, BRANCH_PATH, "PRIMAIRE");
  const titles = links.map((item) => item.title);
  const usersSubs = (links.find((item) => item.title === "Utilisateurs")?.sub ?? []).map(
    (item) => item.title,
  );

  for (const title of [
    "Dashboard",
    "Inscription",
    "Finance",
    "Utilisateurs",
    "Aide",
  ]) {
    assert.ok(titles.includes(title), `caissier doit voir « ${title} »`);
  }
  assert.ok(usersSubs.includes("Élève"), "caissier doit voir sous-menu Élève");
  for (const title of ["Personnel", "Enseignant", "Parent"]) {
    assert.ok(!usersSubs.includes(title), `caissier ne doit pas voir « ${title} »`);
  }
  for (const title of [
    "Presences",
    "Candidatures",
    "Classes",
    "Enseignement",
    "Cursus",
  ]) {
    assert.ok(!titles.includes(title), `caissier ne doit pas voir « ${title} »`);
  }
});

test("dashboard caissier = variante caisse", () => {
  assert.equal(resolveDashboardVariant(sessionCaissier), "caissier");
  assert.notEqual(resolveDashboardVariant(sessionCaissier), "directeur");
  assert.notEqual(resolveDashboardVariant(sessionCaissier), "admin");
});

test("accueil org admin : caissier refusé ; directeur/gestionnaire OK", () => {
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.CAISSIER), false);
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.TEACHER), false);
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.DIRECTEUR), true);
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.GESTIONNAIRE), true);
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.OWNER), true);
});

test("URL pédagogiques : helpers refusent le caissier (classe/notes/attendance)", () => {
  assert.equal(canAccessTeachingArea(sessionCaissier), false);
  assert.equal(canManageOrganization(sessionCaissier), false);
  // teacher garde l’enseignement
  assert.equal(canAccessTeachingArea(sessionTeacher), true);
});

test("CRUD élèves/personnel : canManageOrganization false ⇒ boutons masqués", () => {
  assert.equal(canManageOrganization(sessionCaissier), false);
});

console.log("\nAll unit-04 caissier perimeter smoke tests passed.");
