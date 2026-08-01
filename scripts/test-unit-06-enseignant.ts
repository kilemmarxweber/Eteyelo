/**
 * Smoke tests — unit-06 périmètre enseignant (teaching area, pas admin/caisse).
 */
import assert from "node:assert/strict";

import { resolveDashboardVariant } from "../lib/auth/dashboard-variant";
import {
  canAccessFinanceArea,
  canAccessPedagogyArea,
  canAccessResultsArea,
  canAccessTeachingArea,
  canAccessTitulaireFichesArea,
  canManageOrganization,
} from "../lib/auth/session-roles";
import { ORG_ROLE } from "../lib/permissions";
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

const sessionTeacher = sessionWithOrgRole(ORG_ROLE.TEACHER);
const sessionTitulaire = sessionWithOrgRole(ORG_ROLE.TEACHER, {
  teacherContext: { isTitulaire: true, teacherId: "t1" },
});
const sessionNonTitulaire = sessionWithOrgRole(ORG_ROLE.TEACHER, {
  teacherContext: { isTitulaire: false, teacherId: "t2" },
});
const sessionCaissier = sessionWithOrgRole(ORG_ROLE.CAISSIER);
const sessionDirecteur = sessionWithOrgRole(ORG_ROLE.DIRECTEUR);

test("enseignant : teaching oui, finance / pedagogy / manage non", () => {
  assert.equal(canAccessTeachingArea(sessionTeacher), true);
  assert.equal(canAccessResultsArea(sessionTeacher), true);
  assert.equal(canAccessFinanceArea(sessionTeacher), false);
  assert.equal(canAccessPedagogyArea(sessionTeacher), false);
  assert.equal(canManageOrganization(sessionTeacher), false);
});

test("URL /paiement refusée via canAccessFinanceArea", () => {
  assert.equal(canAccessFinanceArea(sessionTeacher), false);
  assert.equal(canAccessFinanceArea(sessionDirecteur), false);
});

test("setup Classes / Cours / Inscription / Affectations : pedagogy, pas teaching", () => {
  // Gates pages unit-06 : canAccessPedagogyArea (enseignant = false)
  assert.equal(canAccessPedagogyArea(sessionTeacher), false);
  assert.equal(canAccessPedagogyArea(sessionDirecteur), true);
  // teaching reste pour horaire / notes / présences
  assert.equal(canAccessTeachingArea(sessionTeacher), true);
});

test("menu enseignant : pas Finance / Enseignement / Utilisateurs ; Horaire via Tableau de bord", () => {
  const links = buildStaticSideLinks(sessionTeacher, BRANCH_PATH, "PRIMAIRE");
  const titles = links.map((item) => item.title);
  const cursus = links.find((item) => item.title === "Cursus");
  const cursusSubs = (cursus?.sub ?? []).map((item) => item.title);

  assert.ok(titles.includes("Tableau de bord"));
  assert.ok(titles.includes("Cursus"));
  assert.ok(titles.includes("Présences"));
  assert.ok(!titles.includes("Finance"), "enseignant ne doit pas voir Finance");
  assert.ok(!titles.includes("Classes"), "enseignant ne doit pas voir Classes");
  assert.ok(!titles.includes("Inscription"));
  assert.ok(!titles.includes("Enseignement"), "enseignant : Enseignement retiré");
  assert.ok(!titles.includes("Utilisateurs"), "enseignant : Utilisateurs retiré");
  assert.ok(cursusSubs.includes("Notes"));
  assert.ok(cursusSubs.includes("Résultats"));
  assert.ok(!cursusSubs.includes("Fiche Centrale"));
  assert.ok(!cursusSubs.includes("Fiches"));
});

test("titulaire voit Fiches / Fiche Centrale ; non-titulaire non", () => {
  assert.equal(canAccessTitulaireFichesArea(sessionTitulaire), true);
  assert.equal(canAccessTitulaireFichesArea(sessionNonTitulaire), false);
  assert.equal(canAccessTitulaireFichesArea(sessionTeacher), false);
  assert.equal(canAccessTitulaireFichesArea(sessionDirecteur), true);

  const titulaireCursus = (
    buildStaticSideLinks(sessionTitulaire, BRANCH_PATH, "PRIMAIRE").find(
      (item) => item.title === "Cursus",
    )?.sub ?? []
  ).map((item) => item.title);
  assert.ok(titulaireCursus.includes("Fiche Centrale"));
  assert.ok(titulaireCursus.includes("Fiches"));

  const nonTitulaireCursus = (
    buildStaticSideLinks(sessionNonTitulaire, BRANCH_PATH, "PRIMAIRE").find(
      (item) => item.title === "Cursus",
    )?.sub ?? []
  ).map((item) => item.title);
  assert.ok(!nonTitulaireCursus.includes("Fiche Centrale"));
  assert.ok(!nonTitulaireCursus.includes("Fiches"));
});

test("Tableau de bord = variante enseignant (pas revenus école)", () => {
  assert.equal(resolveDashboardVariant(sessionTeacher), "teacher");
  assert.notEqual(resolveDashboardVariant(sessionTeacher), "directeur");
  assert.notEqual(resolveDashboardVariant(sessionTeacher), "caissier");
});

test("TEACHING_ROLES non élargi via caissier (caissier hors teaching)", () => {
  assert.equal(canAccessTeachingArea(sessionCaissier), false);
  const titles = buildStaticSideLinks(
    sessionCaissier,
    BRANCH_PATH,
    "PRIMAIRE",
  ).map((item) => item.title);
  assert.ok(!titles.includes("Enseignement"));
  assert.ok(!titles.includes("Présences"));
});

console.log("\nAll unit-06 enseignant smoke tests passed.");
