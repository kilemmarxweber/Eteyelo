import assert from "node:assert/strict";

import {
  isCursusSelfScopedRole,
  resolveCursusViewerRole,
} from "../lib/auth/cursus-scope";
import {
  getDashboardDataBlocks,
  resolveDashboardVariant,
} from "../lib/auth/dashboard-variant";
import {
  canAccessLibraryArea,
  canAccessNotesReadArea,
  canAccessScheduleReadArea,
  canManageOrganization,
} from "../lib/auth/session-roles";
import { resolveMembershipPostLoginPath } from "../lib/auth/post-login-routing";
import { orgRoleLabel } from "../lib/org-role-labels";
import { ORG_ROLE } from "../lib/permissions";
import { getPeopleLabels } from "../lib/people-labels";
import { getPrimaryRoleLabel } from "../lib/sidebar-menu";
import { TypeBrache } from "../prisma/generated/prisma/enums";
import { getDashboardShortcuts } from "../app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/dashboard-shortcuts";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function sessionWithOrgRole(
  role: string,
  extras: Record<string, unknown> = {},
) {
  return { organization: { role }, ...extras };
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

test("parent : pas notes / horaire / bibliothèque ; pas manage org", () => {
  assert.equal(canAccessNotesReadArea(sessionStudent), false);
  assert.equal(canAccessNotesReadArea(sessionParent), false);
  assert.equal(canAccessScheduleReadArea(sessionStudent), false);
  assert.equal(canAccessScheduleReadArea(sessionParent), false);
  assert.equal(canManageOrganization(sessionStudent), false);
  assert.equal(canManageOrganization(sessionParent), false);
});

test("bibliothèque : élève et enseignant oui ; parent non", () => {
  assert.equal(canAccessLibraryArea(sessionStudent), true);
  assert.equal(canAccessLibraryArea(sessionParent), false);
  assert.equal(canAccessLibraryArea(sessionTeacher), true);
});

test("libellés typebranche : Élève / Apprenant / Étudiant", () => {
  assert.equal(getPeopleLabels(TypeBrache.PRIMAIRE).student, "Élève");
  assert.equal(getPeopleLabels(TypeBrache.SECONDAIRE).student, "Élève");
  assert.equal(getPeopleLabels(TypeBrache.CENTRE_FORMATION).student, "Apprenant");
  assert.equal(getPeopleLabels(TypeBrache.UNIVERSITE).student, "Étudiant");
  assert.equal(
    orgRoleLabel(ORG_ROLE.STUDENT, { typebranch: TypeBrache.CENTRE_FORMATION }),
    "Apprenant",
  );
  assert.equal(
    orgRoleLabel(ORG_ROLE.STUDENT, { typebranch: TypeBrache.UNIVERSITE }),
    "Étudiant",
  );
  assert.equal(
    orgRoleLabel(ORG_ROLE.TEACHER, { typebranch: TypeBrache.UNIVERSITE }),
    "Professeur",
  );
  assert.equal(
    getPrimaryRoleLabel(
      sessionWithOrgRole(ORG_ROLE.STUDENT, {
        branch: { typebranch: TypeBrache.UNIVERSITE },
      }),
    ),
    "Étudiant",
  );
});

test("dashboard élève : variante student ; raccourcis Ma fiche + Résultats + Devoirs + Bibliothèque", () => {
  assert.equal(resolveDashboardVariant(sessionStudent), "student");
  const blocks = getDashboardDataBlocks("student");
  assert.equal(blocks.student, true);
  assert.equal(blocks.revenue, false);
  assert.equal(blocks.cashier, false);

  const shortcuts = getDashboardShortcuts(
    "student",
    {
      organizationId: "org-test",
      branchId: "branch-test",
      studentPluralLower: "élèves",
      classLabelPlural: "Classes",
      showFinance: false,
    },
    (key) =>
      ({
        "shortcuts.myFile": "Ma fiche",
        "shortcuts.myFileDesc": "Mon dossier et mes documents scolaires",
        "shortcuts.results": "Résultats",
        "shortcuts.myResults": "Mes résultats scolaires",
        "shortcuts.homework": "Devoirs",
        "shortcuts.weekendHomework": "Mes devoirs du weekend",
        "shortcuts.library": "Bibliothèque",
        "shortcuts.readingResources": "Ressources en lecture",
      })[key] ?? key,
  );
  const titles = shortcuts.map((item) => item.title);
  assert.deepEqual(titles, ["Ma fiche", "Résultats", "Devoirs", "Bibliothèque"]);
  assert.ok(!titles.includes("Notes"));
  assert.ok(!titles.includes("Fiches"));
});

test("post-login élève → branche", () => {
  assert.equal(
    resolveMembershipPostLoginPath({
      organizationId: "org-test",
      membershipRole: ORG_ROLE.STUDENT,
      branchId: "branch-primaire",
      branchCount: 1,
    }),
    "/admin/organizations/org-test/branches/branch-primaire",
  );
});

console.log("\nAll unit-05 eleve/parent smoke tests passed.");
