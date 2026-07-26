import assert from "node:assert/strict";

import {
  isCursusSelfScopedRole,
  resolveCursusViewerRole,
} from "../lib/auth/cursus-scope";
import {
  canAccessLibraryArea,
  canAccessNotesReadArea,
  canAccessScheduleReadArea,
  canManageOrganization,
} from "../lib/auth/session-roles";
import { ORG_ROLE } from "../lib/permissions";
import { getPeopleLabels } from "../lib/people-labels";
import { TypeBrache } from "../prisma/generated/prisma/enums";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function sessionWithOrgRole(role: string) {
  return { organization: { role } };
}

const sessionStudent = sessionWithOrgRole(ORG_ROLE.STUDENT);
const sessionParent = sessionWithOrgRole(ORG_ROLE.PARENT);
const sessionTeacher = sessionWithOrgRole(ORG_ROLE.TEACHER);
const sessionCaissier = sessionWithOrgRole(ORG_ROLE.CAISSIER);
const sessionDirecteur = sessionWithOrgRole(ORG_ROLE.DIRECTEUR);

test("resolveCursusViewerRole : student / parent / teacher / admin", () => {
  assert.equal(resolveCursusViewerRole(sessionStudent), "student");
  assert.equal(resolveCursusViewerRole(sessionParent), "parent");
  assert.equal(resolveCursusViewerRole(sessionTeacher), "teacher");
  assert.equal(resolveCursusViewerRole(sessionDirecteur), "admin");
  assert.equal(resolveCursusViewerRole(sessionCaissier), null);
});

test("isCursusSelfScopedRole pour élève et parent uniquement", () => {
  assert.equal(isCursusSelfScopedRole("student"), true);
  assert.equal(isCursusSelfScopedRole("parent"), true);
  assert.equal(isCursusSelfScopedRole("teacher"), false);
  assert.equal(isCursusSelfScopedRole("admin"), false);
});

test("élève / parent : notes + horaire lecture, pas manage org", () => {
  assert.equal(canAccessNotesReadArea(sessionStudent), true);
  assert.equal(canAccessNotesReadArea(sessionParent), true);
  assert.equal(canAccessScheduleReadArea(sessionStudent), true);
  assert.equal(canAccessScheduleReadArea(sessionParent), true);
  assert.equal(canManageOrganization(sessionStudent), false);
  assert.equal(canManageOrganization(sessionParent), false);
});

test("bibliothèque : élève, parent et enseignant oui", () => {
  assert.equal(canAccessLibraryArea(sessionStudent), true);
  assert.equal(canAccessLibraryArea(sessionParent), true);
  assert.equal(canAccessLibraryArea(sessionTeacher), true);
});

test("libellés primaire = Élève via getPeopleLabels", () => {
  const labels = getPeopleLabels(TypeBrache.PRIMAIRE);
  assert.equal(labels.student, "Élève");
  assert.equal(labels.teacher, "Enseignant");
});

console.log("\nAll unit-05 eleve/parent smoke tests passed.");
