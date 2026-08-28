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
import { getDashboardShortcuts } from "../app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/dashboard-shortcuts";

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

function shortcutLabel(key: string) {
  return (
    {
      "shortcuts.myCheckIn": "Mon pointage",
      "shortcuts.myCheckInDesc": "Pointer",
      "shortcuts.myAttendanceReport": "Mon rapport de présence",
      "shortcuts.myAttendanceReportDesc": "Rapport",
      "shortcuts.grades": "Notes",
      "shortcuts.enterGrades": "Saisir",
      "shortcuts.attendance": "Présences",
      "shortcuts.attendanceMyClasses": "Mes classes",
      "shortcuts.schedule": "Horaire",
      "shortcuts.mySchedule": "Mon horaire",
      "shortcuts.results": "Résultats",
      "shortcuts.classResults": "Mes classes",
      "shortcuts.registration": "Inscription",
      "shortcuts.registerStudents": "Enregistrer",
      "shortcuts.payment": "Paiement",
      "shortcuts.collectPayments": "Encaisser",
      "shortcuts.enrollStudents": "Inscrire",
      "shortcuts.attendanceToday": "Aujourd'hui",
      "shortcuts.users": "Utilisateurs",
      "shortcuts.managePeople": "Gérer",
    }[key] ?? key
  );
}

function presenceShortcutTitles(
  variant: "teacher" | "caissier" | "directeur" | "prefet" | "directeur_etudes",
) {
  return getDashboardShortcuts(
    variant,
    {
      organizationId: "org-test",
      branchId: "branch-primaire",
      studentPluralLower: "élèves",
      classLabelPlural: "Classes",
      showFinance: false,
    },
    shortcutLabel,
  ).map((item) => item.title);
}

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

test("dashboard enseignant : raccourcis pointage + rapport de présence", () => {
  const shortcuts = getDashboardShortcuts(
    "teacher",
    {
      organizationId: "org-test",
      branchId: "branch-primaire",
      studentPluralLower: "élèves",
      classLabelPlural: "Classes",
      showFinance: false,
    },
    shortcutLabel,
  );
  const titles = shortcuts.map((item) => item.title);
  assert.ok(titles.includes("Mon pointage"));
  assert.ok(titles.includes("Mon rapport de présence"));
  assert.ok(
    shortcuts.some((item) => item.href.endsWith("/ma-presence")),
  );
});

test("dashboard caissier / direction : aussi pointage + rapport perso", () => {
  for (const variant of [
    "caissier",
    "directeur",
    "prefet",
    "directeur_etudes",
  ] as const) {
    const titles = presenceShortcutTitles(variant);
    assert.ok(titles.includes("Mon pointage"), variant);
    assert.ok(titles.includes("Mon rapport de présence"), variant);
  }
});

test("menu enseignant : pas Finance / Enseignement / Utilisateurs ; Horaire via Tableau de bord", () => {
  const links = buildStaticSideLinks(sessionTeacher, BRANCH_PATH, "PRIMAIRE");
  const titles = links.map((item) => item.title);
  const cursus = links.find((item) => item.title === "cursus");
  const cursusSubs = (cursus?.sub ?? []).map((item) => item.title);

  assert.ok(titles.includes("dashboard"));
  assert.ok(titles.includes("myPresence"));
  assert.ok(titles.includes("cursus"));
  assert.ok(titles.includes("attendance"));
  assert.ok(!titles.includes("finance"), "enseignant ne doit pas voir Finance");
  assert.ok(!titles.includes("classes"), "enseignant ne doit pas voir Classes");
  assert.ok(!titles.includes("registration"));
  assert.ok(!titles.includes("teaching"), "enseignant : Enseignement retiré");
  assert.ok(!titles.includes("users"), "enseignant : Utilisateurs retiré");
  assert.ok(cursusSubs.includes("grades"));
  assert.ok(cursusSubs.includes("results"));
  assert.ok(!cursusSubs.includes("centralSheet"));
  assert.ok(!cursusSubs.includes("sheets"));
});

test("titulaire voit Fiches / Fiche Centrale ; non-titulaire non", () => {
  assert.equal(canAccessTitulaireFichesArea(sessionTitulaire), true);
  assert.equal(canAccessTitulaireFichesArea(sessionNonTitulaire), false);
  assert.equal(canAccessTitulaireFichesArea(sessionTeacher), false);
  assert.equal(canAccessTitulaireFichesArea(sessionDirecteur), true);

  const titulaireCursus = (
    buildStaticSideLinks(sessionTitulaire, BRANCH_PATH, "PRIMAIRE").find(
      (item) => item.title === "cursus",
    )?.sub ?? []
  ).map((item) => item.title);
  assert.ok(titulaireCursus.includes("centralSheet"));
  assert.ok(titulaireCursus.includes("sheets"));

  const nonTitulaireCursus = (
    buildStaticSideLinks(sessionNonTitulaire, BRANCH_PATH, "PRIMAIRE").find(
      (item) => item.title === "cursus",
    )?.sub ?? []
  ).map((item) => item.title);
  assert.ok(!nonTitulaireCursus.includes("centralSheet"));
  assert.ok(!nonTitulaireCursus.includes("sheets"));
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
  assert.ok(!titles.includes("teaching"));
  assert.ok(!titles.includes("attendance"));
  assert.ok(titles.includes("myPresence"));
});

console.log("\nAll unit-06 enseignant smoke tests passed.");
