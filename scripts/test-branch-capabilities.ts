import assert from "node:assert/strict";

import { getAcademicStructure } from "../lib/academic-structure";
import {
  canCreateStudentInBranch,
  getBranchCapabilities,
  getClassDisplayLabel,
  isAtelierBranch,
  isCentreFormationBranch,
  isExtendedBranch,
  isSchoolBranch,
  isUniversiteBranch,
  requiresStudentImport,
  usesBulletinForBranch,
  usesReleveForBranch,
} from "../lib/branch-capabilities";
import {
  getClassLevelsForBranch,
  isValidClassLevel,
  requiresOptionForClass,
  requiresSectionForClass,
} from "../lib/class-structure";
import { branchTypeSchema, importStudentSchema } from "../lib/schemas/extended-branch";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("branchTypeSchema accepte les 5 types", () => {
  for (const type of [
    "PRIMAIRE",
    "SECONDAIRE",
    "ATELIER",
    "CENTRE_FORMATION",
    "UNIVERSITE",
  ] as const) {
    assert.equal(branchTypeSchema.parse(type), type);
  }
});

test("atelier : import obligatoire, pas de creation directe", () => {
  assert.equal(isAtelierBranch("ATELIER"), true);
  assert.equal(requiresStudentImport("ATELIER"), true);
  assert.equal(canCreateStudentInBranch("ATELIER"), false);
  assert.equal(usesBulletinForBranch("ATELIER"), false);
});

test("centre de formation : creation ou import + brevet", () => {
  assert.equal(isCentreFormationBranch("CENTRE_FORMATION"), true);
  assert.equal(canCreateStudentInBranch("CENTRE_FORMATION"), true);
  assert.equal(getBranchCapabilities("CENTRE_FORMATION").usesBrevet, true);
});

test("universite : auditoire + releve, pas bulletin", () => {
  assert.equal(isUniversiteBranch("UNIVERSITE"), true);
  assert.equal(getClassDisplayLabel("UNIVERSITE"), "Auditoire");
  assert.equal(usesReleveForBranch("UNIVERSITE"), true);
  assert.equal(usesBulletinForBranch("UNIVERSITE"), false);
});

test("branches scolaires vs etendues", () => {
  assert.equal(isSchoolBranch("PRIMAIRE"), true);
  assert.equal(isSchoolBranch("SECONDAIRE"), true);
  assert.equal(isSchoolBranch("ATELIER"), false);
  assert.equal(isExtendedBranch("UNIVERSITE"), true);
  assert.equal(isExtendedBranch("PRIMAIRE"), false);
});

test("structures academiques par type", () => {
  assert.equal(getAcademicStructure("PRIMAIRE").periods.length, 9);
  assert.equal(getAcademicStructure("SECONDAIRE").periods.length, 6);
  assert.equal(getAcademicStructure("UNIVERSITE").periods.length, 10);
  assert.equal(getAcademicStructure("CENTRE_FORMATION").periods.length, 5);
  assert.equal(getAcademicStructure("ATELIER").periods.length, 1);
});

test("niveaux de classe par type", () => {
  assert.equal(getClassLevelsForBranch("UNIVERSITE").includes("L1"), true);
  assert.equal(getClassLevelsForBranch("ATELIER").includes("Groupe"), true);
  assert.equal(isValidClassLevel("CENTRE_FORMATION", "Session"), true);
  assert.equal(requiresOptionForClass("UNIVERSITE", "L1"), true);
  assert.equal(requiresSectionForClass("SECONDAIRE", "1ère"), true);
  assert.equal(requiresSectionForClass("SECONDAIRE", "7ème"), false);
  assert.equal(requiresSectionForClass("SECONDAIRE", "8ème"), false);
  assert.equal(requiresSectionForClass("SECONDAIRE", "1"), true);
});

test("importStudentSchema valide les champs requis", () => {
  const parsed = importStudentSchema.parse({
    studentId: "stu_1",
    targetBranchId: "branch_atelier",
    sourceBranchId: "branch_secondaire",
  });
  assert.equal(parsed.studentId, "stu_1");
});

console.log("\nTous les tests branch-capabilities sont passes.");
