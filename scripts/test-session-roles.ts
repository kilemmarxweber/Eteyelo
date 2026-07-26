import assert from "node:assert/strict";

import {
  canAccessFinanceArea,
  canAccessLibraryArea,
  canAccessNotesReadArea,
  canAccessPedagogyArea,
  canAccessResultsArea,
  canAccessScheduleReadArea,
  canAccessTeachingArea,
  canManageHrDirectory,
  canManageOrganization,
  canReadScheduleArea,
  canSeeCandidatureNotifications,
  canSeeInscriptionNotifications,
  isSchoolLeadershipRole,
} from "../lib/auth/session-roles";
import { ORG_ROLE } from "../lib/permissions";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function sessionWithOrgRole(role: string) {
  return { organization: { role } };
}

const sessionCaissier = sessionWithOrgRole(ORG_ROLE.CAISSIER);
const sessionDirecteur = sessionWithOrgRole(ORG_ROLE.DIRECTEUR);
const sessionPrefet = sessionWithOrgRole(ORG_ROLE.PREFET);
const sessionTeacher = sessionWithOrgRole(ORG_ROLE.TEACHER);
const sessionStudent = sessionWithOrgRole(ORG_ROLE.STUDENT);
const sessionParent = sessionWithOrgRole(ORG_ROLE.PARENT);
const sessionGestionnaire = sessionWithOrgRole(ORG_ROLE.GESTIONNAIRE);

test("canManageOrganization(sessionCaissier) === false", () => {
  assert.equal(canManageOrganization(sessionCaissier), false);
});

test("canAccessFinanceArea(sessionCaissier) === true", () => {
  assert.equal(canAccessFinanceArea(sessionCaissier), true);
});

test("canAccessTeachingArea(sessionCaissier) === false", () => {
  assert.equal(canAccessTeachingArea(sessionCaissier), false);
});

test("canAccessFinanceArea(sessionDirecteur) === true", () => {
  assert.equal(canAccessFinanceArea(sessionDirecteur), true);
});

test("canAccessFinanceArea(sessionPrefet) === true (alias chef établissement)", () => {
  assert.equal(canAccessFinanceArea(sessionPrefet), true);
});

test("canAccessFinanceArea(directeur_etudes) === false", () => {
  assert.equal(
    canAccessFinanceArea(sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES)),
    false,
  );
});

test("canManageOrganization inclut leadership et gestionnaire", () => {
  assert.equal(canManageOrganization(sessionDirecteur), true);
  assert.equal(canManageOrganization(sessionPrefet), true);
  assert.equal(canManageOrganization(sessionGestionnaire), true);
  assert.equal(canManageOrganization(sessionTeacher), false);
});

test("isSchoolLeadershipRole = prefet + directeur + superviseur", () => {
  assert.equal(isSchoolLeadershipRole(sessionPrefet), true);
  assert.equal(isSchoolLeadershipRole(sessionDirecteur), true);
  assert.equal(
    isSchoolLeadershipRole(sessionWithOrgRole(ORG_ROLE.SUPERVISEUR)),
    true,
  );
  assert.equal(isSchoolLeadershipRole(sessionGestionnaire), false);
  assert.equal(isSchoolLeadershipRole(sessionCaissier), false);
});

test("canAccessPedagogyArea exclut caissier et teacher", () => {
  assert.equal(canAccessPedagogyArea(sessionPrefet), true);
  assert.equal(canAccessPedagogyArea(sessionDirecteur), true);
  assert.equal(
    canAccessPedagogyArea(sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES)),
    true,
  );
  assert.equal(canAccessPedagogyArea(sessionGestionnaire), true);
  assert.equal(canAccessPedagogyArea(sessionCaissier), false);
  assert.equal(canAccessPedagogyArea(sessionTeacher), false);
});

test("canAccessResultsArea sans caissier, avec student/parent", () => {
  assert.equal(canAccessResultsArea(sessionCaissier), false);
  assert.equal(canAccessResultsArea(sessionTeacher), true);
  assert.equal(canAccessResultsArea(sessionStudent), true);
  assert.equal(canAccessResultsArea(sessionParent), true);
});

test("canAccessNotesReadArea : parent/teacher oui, élève et caissier non", () => {
  assert.equal(canAccessNotesReadArea(sessionStudent), false);
  assert.equal(canAccessNotesReadArea(sessionParent), true);
  assert.equal(canAccessNotesReadArea(sessionTeacher), true);
  assert.equal(canAccessNotesReadArea(sessionCaissier), false);
});

test("canReadScheduleArea : parent/teacher oui, élève et caissier non", () => {
  assert.equal(canReadScheduleArea(sessionStudent), false);
  assert.equal(canReadScheduleArea(sessionParent), true);
  assert.equal(canAccessScheduleReadArea(sessionTeacher), true);
  assert.equal(canReadScheduleArea(sessionCaissier), false);
});

test("canAccessLibraryArea sans caissier ; student/teacher/parent oui", () => {
  assert.equal(canAccessLibraryArea(sessionCaissier), false);
  assert.equal(canAccessLibraryArea(sessionStudent), true);
  assert.equal(canAccessLibraryArea(sessionTeacher), true);
  assert.equal(canAccessLibraryArea(sessionParent), true);
  assert.equal(canAccessLibraryArea(sessionDirecteur), true);
});

test("canManageHrDirectory : chef école CRUD ; directeur des études lecture seule", () => {
  assert.equal(canManageHrDirectory(sessionPrefet), true);
  assert.equal(canManageHrDirectory(sessionDirecteur), true);
  assert.equal(
    canManageHrDirectory(sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES)),
    false,
  );
  assert.equal(canManageHrDirectory(sessionGestionnaire), true);
  assert.equal(canManageHrDirectory(sessionTeacher), false);
});

test("notifications : caissier inscription oui, candidature non", () => {
  assert.equal(canSeeInscriptionNotifications(sessionCaissier), true);
  assert.equal(canSeeCandidatureNotifications(sessionCaissier), false);
  assert.equal(canSeeCandidatureNotifications(sessionPrefet), true);
});

console.log("\nAll session-roles helper smoke tests passed.");
