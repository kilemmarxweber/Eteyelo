/**
 * Smoke tests — unit-09 gardes de routes (`assertBranchAreaAccess`).
 * Vérifie la carte des zones par rôle (URL directe / helpers).
 */
import assert from "node:assert/strict";

import {
  canAccessBranchArea,
  type BranchArea,
} from "../lib/auth/assert-branch-area-access";
import { canAccessOrganizationAdminHome } from "../lib/auth/organization-admin-home";
import { ORG_ROLE } from "../lib/permissions";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function sessionWithOrgRole(role: string) {
  return { organization: { role } };
}

const sessionCaissier = sessionWithOrgRole(ORG_ROLE.CAISSIER);
const sessionStudent = sessionWithOrgRole(ORG_ROLE.STUDENT);
const sessionParent = sessionWithOrgRole(ORG_ROLE.PARENT);
const sessionTeacher = sessionWithOrgRole(ORG_ROLE.TEACHER);
const sessionDirecteur = sessionWithOrgRole(ORG_ROLE.DIRECTEUR);
const sessionPrefet = sessionWithOrgRole(ORG_ROLE.PREFET);
const sessionEtudes = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);
const sessionGestionnaire = sessionWithOrgRole(ORG_ROLE.GESTIONNAIRE);

function assertAreas(
  session: unknown,
  allowed: BranchArea[],
  denied: BranchArea[],
) {
  for (const area of allowed) {
    assert.equal(
      canAccessBranchArea(area, session),
      true,
      `expected allow ${area}`,
    );
  }
  for (const area of denied) {
    assert.equal(
      canAccessBranchArea(area, session),
      false,
      `expected deny ${area}`,
    );
  }
}

test("Caissier → /notes refusé ; /paiement OK", () => {
  assertAreas(
    sessionCaissier,
    ["finance"],
    ["notes", "schedule", "results", "school_admin", "teaching", "pedagogy"],
  );
});

test("Élève → /frais refusé ; /results /notes /schedule lecture OK", () => {
  assertAreas(
    sessionStudent,
    ["notes", "schedule", "results", "library"],
    ["finance", "school_admin", "teaching", "pedagogy", "hr_directory"],
  );
});

test("Parent → notes/horaire/results OK ; finance / school_admin refusés", () => {
  assertAreas(
    sessionParent,
    ["notes", "schedule", "results"],
    ["finance", "school_admin", "library", "hr_directory"],
  );
});

test("Enseignant → /paiement refusé ; /notes OK", () => {
  assertAreas(
    sessionTeacher,
    ["notes", "schedule", "results", "teaching"],
    ["finance", "school_admin", "pedagogy", "library"],
  );
});

test("Directeur des études → /paiement refusé ; /classe /teaching OK", () => {
  assertAreas(
    sessionEtudes,
    ["school_admin", "pedagogy", "notes", "schedule", "results", "hr_directory"],
    ["finance", "hr_write", "branch_org_settings"],
  );
});

test("Chef établissement (directeur ou préfet) → /paiement OK ; /classe OK", () => {
  for (const session of [sessionDirecteur, sessionPrefet]) {
    assertAreas(
      session,
      [
        "finance",
        "school_admin",
        "pedagogy",
        "notes",
        "hr_directory",
        "hr_write",
      ],
      ["branch_org_settings"],
    );
  }
});

test("Settings org avancés → refusés pour chef école / études", () => {
  assert.equal(
    canAccessBranchArea("branch_org_settings", sessionDirecteur),
    false,
  );
  assert.equal(
    canAccessBranchArea("branch_org_settings", sessionEtudes),
    false,
  );
  assert.equal(
    canAccessBranchArea("branch_org_settings", sessionGestionnaire),
    true,
  );
});

test("Org hub : caissier/teacher/student/parent exclus ; chef + études OK", () => {
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.CAISSIER), false);
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.TEACHER), false);
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.STUDENT), false);
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.PARENT), false);
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.DIRECTEUR), true);
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.PREFET), true);
  assert.equal(
    canAccessOrganizationAdminHome(ORG_ROLE.DIRECTEUR_ETUDES),
    true,
  );
});

console.log("\nAll unit-09 route-guard smoke tests passed.");
