import assert from "node:assert/strict";

import {
  canCreateStudentInBranch,
  usesAttestationForBranch,
  usesBulletinForBranch,
  usesReleveForBranch,
} from "../lib/branch-capabilities";
import {
  getBranchRouteRedirect,
  shouldHideSidebarHref,
} from "../lib/branch-route-guard";
import { generateReleveNotesPdf } from "../lib/pdf/releve-notes-layout";
import {
  generateUniversityAttestationPdf,
  UNIVERSITY_ATTESTATION_LABELS,
} from "../lib/pdf/university-attestation-layout";
import { getTrainingLabels, usesTrainingLabels } from "../lib/training-labels";
import { getPeopleLabels } from "../lib/people-labels";
import {
  getClassDisplayLabel,
  getClassDisplayLabelPlural,
} from "../lib/branch-capabilities";
import { getAcademicStructure } from "../lib/academic-structure";
import { supportsOptionalStudentImport } from "../lib/extended-student-import";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("universite autorise releve et attestations, pas bulletin", () => {
  assert.equal(usesReleveForBranch("UNIVERSITE"), true);
  assert.equal(usesAttestationForBranch("UNIVERSITE"), true);
  assert.equal(usesBulletinForBranch("UNIVERSITE"), false);
  assert.equal(canCreateStudentInBranch("UNIVERSITE"), true);
  assert.equal(supportsOptionalStudentImport("UNIVERSITE"), true);
});

test("route releves protegee hors universite", () => {
  const redirectPath = getBranchRouteRedirect(
    "/releves",
    "SECONDAIRE",
    "org-1",
    "branch-1",
  );
  assert.equal(
    redirectPath,
    "/admin/organizations/org-1/branches/branch-1/results",
  );
  assert.equal(
    getBranchRouteRedirect("/releves", "UNIVERSITE", "org-1", "branch-u"),
    null,
  );
});

test("sidebar universite affiche releves et facultes", () => {
  assert.equal(usesTrainingLabels("UNIVERSITE"), true);
  assert.equal(shouldHideSidebarHref("/admin/releves", "UNIVERSITE"), false);
  assert.equal(shouldHideSidebarHref("/admin/releves", "SECONDAIRE"), true);
  assert.equal(shouldHideSidebarHref("/admin/fiches", "UNIVERSITE"), true);
  assert.equal(shouldHideSidebarHref("/admin/programmes", "UNIVERSITE"), false);
  assert.equal(shouldHideSidebarHref("/admin/attestations", "UNIVERSITE"), false);
});

test("libelles universite", () => {
  const labels = getTrainingLabels("UNIVERSITE");
  const people = getPeopleLabels("UNIVERSITE");
  assert.equal(labels.programmesMenu, "Facultes");
  assert.equal(labels.modulesMenu, "Filieres");
  assert.match(labels.sectionTitle, /Facult/i);
  assert.equal(people.student, "Étudiant");
  assert.equal(people.studentPlural, "Étudiants");
  assert.equal(people.teacher, "Professeur");
  assert.equal(people.teacherPlural, "Professeurs");
  assert.equal(getClassDisplayLabel("UNIVERSITE"), "Auditoire");
  assert.equal(getClassDisplayLabelPlural("UNIVERSITE"), "Auditoires");
  const uniStructure = getAcademicStructure("UNIVERSITE");
  assert.equal(uniStructure.groups[0]?.label, "Premier semestre");
  assert.equal(uniStructure.groups[1]?.label, "Deuxième semestre");
});

test("generateReleveNotesPdf est invocable", () => {
  assert.equal(typeof generateReleveNotesPdf, "function");
});

test("generateUniversityAttestationPdf est invocable", () => {
  assert.equal(typeof generateUniversityAttestationPdf, "function");
  assert.equal(UNIVERSITY_ATTESTATION_LABELS.INSCRIPTION, "Attestation d'inscription");
});

console.log("\nTous les tests Phase 5 (universite) sont passes.");
