/**
 * Smoke tests — unit-09 gardes de routes (`assertBranchAreaAccess`).
 * Vérifie la carte des zones par rôle (URL directe / helpers).
 */
import assert from "node:assert/strict";

import {
  canAccessBranchArea,
  type BranchArea,
} from "../lib/auth/branch-area-access";
import { canAccessOrganizationAdminHome } from "../lib/auth/organization-admin-home";
import { ORG_ROLE } from "../lib/permissions";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("matrice dynamique : décocher un privilège n'est pas réinjecté par le seed", () => {
  delete process.env.PERMISSIONS_FROM_DAC;
  const session = {
    organization: {
      role: ORG_ROLE.CAISSIER,
      rolePermissions: {
        [ORG_ROLE.CAISSIER]: {
          finance: ["read", "encaisser"],
        },
      },
    },
  };
  assert.equal(canAccessBranchArea("finance", session), true);
  assert.equal(
    canAccessBranchArea("fee_catalog", session),
    false,
    "fees:read du seed ne doit pas revenir si absent de la matrice",
  );
  assert.equal(canAccessBranchArea("registration", session), false);
});

// Carte historique par slug (session-roles). La matrice DB est testée plus haut.
process.env.PERMISSIONS_FROM_DAC = "false";

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
const sessionBranchOwner = {
  user: { role: "user" },
  organization: { role: "user" },
  branchMemberRole: "ADMIN",
};

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

test("Caissier → /notes et /frais refusés ; /paiement + /registration OK", () => {
  assertAreas(
    sessionCaissier,
    ["finance", "registration"],
    [
      "fee_catalog",
      "notes",
      "schedule",
      "results",
      "school_admin",
      "teaching",
      "pedagogy",
    ],
  );
});

test("Élève → /frais /notes /schedule refusés ; /results /library OK", () => {
  assertAreas(
    sessionStudent,
    ["results", "library"],
    [
      "finance",
      "notes",
      "schedule",
      "school_admin",
      "teaching",
      "pedagogy",
      "hr_directory",
    ],
  );
});

test("Parent → results OK ; notes/horaire/library/devoirs / finance / school_admin refusés", () => {
  assertAreas(
    sessionParent,
    ["results"],
    ["notes", "schedule", "library", "devoirs", "finance", "school_admin", "hr_directory"],
  );
});

test("Enseignant → /paiement refusé ; /notes /library OK", () => {
  assertAreas(
    sessionTeacher,
    ["notes", "schedule", "results", "teaching", "library"],
    ["finance", "school_admin", "pedagogy"],
  );
});

test("Directeur des études → /paiement refusé ; /classe /teaching OK", () => {
  assertAreas(
    sessionEtudes,
    ["school_admin", "pedagogy", "notes", "schedule", "results", "hr_directory"],
    ["finance", "hr_write", "branch_org_settings"],
  );
});

test("Chef établissement (directeur ou préfet) → pédagogie OK ; /paiement refusé", () => {
  for (const session of [sessionDirecteur, sessionPrefet]) {
    assertAreas(
      session,
      [
        "school_admin",
        "pedagogy",
        "notes",
        "hr_directory",
        "hr_write",
        "school_ops_settings",
        "support_settings",
      ],
      ["finance", "branch_org_settings"],
    );
  }
});

test("Settings org avancés → refusés pour chef école / études ; ops/support OK chef", () => {
  assert.equal(
    canAccessBranchArea("branch_org_settings", sessionDirecteur),
    false,
  );
  assert.equal(
    canAccessBranchArea("school_ops_settings", sessionDirecteur),
    true,
  );
  assert.equal(
    canAccessBranchArea("support_settings", sessionCaissier),
    true,
  );
  assert.equal(
    canAccessBranchArea("support_settings", sessionTeacher),
    true,
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

test("propriétaire de branche → accès complet malgré user organisation", () => {
  assertAreas(
    sessionBranchOwner,
    [
      "finance",
      "school_admin",
      "teaching",
      "results",
      "branch_org_settings",
      "school_ops_settings",
      "support_settings",
    ],
    [],
  );
});

test("paie → propriétaire uniquement", () => {
  assert.equal(canAccessBranchArea("payroll", sessionBranchOwner), true);
  assert.equal(canAccessBranchArea("payroll", sessionWithOrgRole(ORG_ROLE.OWNER)), true);
  for (const role of [
    ORG_ROLE.GESTIONNAIRE,
    ORG_ROLE.DIRECTEUR,
    ORG_ROLE.DIRECTEUR_ETUDES,
    ORG_ROLE.CAISSIER,
    ORG_ROLE.TEACHER,
  ]) {
    assert.equal(
      canAccessBranchArea("payroll", sessionWithOrgRole(role)),
      false,
      `${role} ne doit pas accéder à la paie`,
    );
  }
});

test("paie avec DAC → un privilège payroll ne suffit pas sans propriétaire", () => {
  process.env.PERMISSIONS_FROM_DAC = "true";
  const delegatedPayroll = {
    organization: {
      role: ORG_ROLE.GESTIONNAIRE,
      rolePermissions: {
        [ORG_ROLE.GESTIONNAIRE]: {
          payroll: ["read", "compute", "validate", "pay"],
        },
      },
    },
  };

  assert.equal(canAccessBranchArea("payroll", delegatedPayroll), false);
  assert.equal(
    canAccessBranchArea("payroll", {
      organization: { role: ORG_ROLE.OWNER, rolePermissions: {} },
    }),
    true,
  );
  process.env.PERMISSIONS_FROM_DAC = "false";
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
