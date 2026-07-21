import assert from "node:assert/strict";

import { normalizeBranchType } from "../lib/academic-structure";
import {
  assertDocumentIssuePermission,
  canIssueBranchDocuments,
  getAllowedDocumentActions,
  isDocumentIssueAllowedForBranch,
} from "../lib/branch-document-permissions";
import {
  canCreateStudentInBranch,
  requiresStudentImport,
  usesAttestationForBranch,
  usesBrevetForBranch,
  usesReleveForBranch,
} from "../lib/branch-capabilities";
import { getBranchTypeHelpContent } from "../lib/branch-type-help";
import { branchTypeSchema } from "../lib/schemas/extended-branch";
import { ORG_ROLE } from "../lib/permissions";
import { createAttestationPdfOutput } from "../lib/pdf/attestation-layout";
import { createBrevetPdfOutputSync } from "../lib/pdf/brevet-layout-server";
import { createReleveNotesPdfOutput } from "../lib/pdf/releve-notes-layout";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function mockSession(orgRole: string) {
  return { organization: { role: orgRole }, user: { role: "user" } };
}

test("gestionnaire peut emettre des documents, caissier non", () => {
  assert.equal(
    canIssueBranchDocuments(mockSession(ORG_ROLE.GESTIONNAIRE)),
    true,
  );
  assert.equal(
    canIssueBranchDocuments(mockSession(ORG_ROLE.DIRECTEUR)),
    true,
  );
  assert.equal(
    canIssueBranchDocuments(mockSession(ORG_ROLE.CAISSIER)),
    false,
  );
});

test("assertDocumentIssuePermission valide action par type", () => {
  const session = mockSession(ORG_ROLE.GESTIONNAIRE);

  assert.equal(
    assertDocumentIssuePermission({
      session,
      typebranch: "CENTRE_FORMATION",
      action: "ISSUE_BREVET",
    }).ok,
    true,
  );

  assert.equal(
    assertDocumentIssuePermission({
      session,
      typebranch: "SECONDAIRE",
      action: "ISSUE_BREVET",
    }).ok,
    false,
  );

  assert.equal(
    assertDocumentIssuePermission({
      session: mockSession(ORG_ROLE.CAISSIER),
      typebranch: "UNIVERSITE",
      action: "ISSUE_RELEVE",
    }).ok,
    false,
  );
});

test("actions document autorisees par type", () => {
  assert.deepEqual(getAllowedDocumentActions("ATELIER"), [
    "ISSUE_ATTESTATION",
    "ATTACH_PDF",
  ]);
  assert.ok(getAllowedDocumentActions("CENTRE_FORMATION").includes("ISSUE_BREVET"));
  assert.ok(getAllowedDocumentActions("UNIVERSITE").includes("ISSUE_RELEVE"));
  assert.equal(isDocumentIssueAllowedForBranch("PRIMAIRE", "ISSUE_BREVET"), false);
});

test("migration enum : schema accepte les 5 types, fallback securise", () => {
  for (const type of [
    "PRIMAIRE",
    "SECONDAIRE",
    "ATELIER",
    "CENTRE_FORMATION",
    "UNIVERSITE",
  ] as const) {
    assert.equal(branchTypeSchema.parse(type), type);
    assert.equal(normalizeBranchType(type), type);
  }

  assert.equal(normalizeBranchType(undefined), "SECONDAIRE");
});

test("E2E simule atelier : import obligatoire puis attestation", () => {
  assert.equal(requiresStudentImport("ATELIER"), true);
  assert.equal(canCreateStudentInBranch("ATELIER"), false);
  assert.equal(usesAttestationForBranch("ATELIER"), true);

  const help = getBranchTypeHelpContent("ATELIER");
  assert.match(help.sections[0].items.join(" "), /Importer/i);
  assert.match(help.sections[0].items.join(" "), /attestation/i);

  const pdf = createAttestationPdfOutput({
    organizationName: "Org",
    branchName: "Atelier",
    studentName: "Jean Kabila",
    workshopName: "Menuiserie",
    groupName: "Groupe A",
    schoolYearName: "2025-2026",
  });
  assert.ok(pdf.blob.size > 0);
});

test("E2E simule centre : creation apprenant puis brevet", () => {
  assert.equal(canCreateStudentInBranch("CENTRE_FORMATION"), true);
  assert.equal(usesBrevetForBranch("CENTRE_FORMATION"), true);

  const help = getBranchTypeHelpContent("CENTRE_FORMATION");
  assert.match(help.sections[0].items.join(" "), /brevet/i);

  const pdf = createBrevetPdfOutputSync({
    organizationName: "Org",
    branchName: "Centre",
    studentName: "Marie Dupont",
    brevetNumber: "CF-2026-0001",
    programmeName: "Informatique",
    sessionName: "Session 1",
  });
  assert.ok(pdf.blob.size > 0);
});

test("E2E simule universite : auditoire puis releve", () => {
  assert.equal(usesReleveForBranch("UNIVERSITE"), true);
  assert.equal(usesAttestationForBranch("UNIVERSITE"), true);

  const help = getBranchTypeHelpContent("UNIVERSITE");
  assert.match(help.sections[0].items.join(" "), /releve/i);

  const pdf = createReleveNotesPdfOutput({
    studentId: "s1",
    studentName: "Paul Mbuyi",
    username: "PM001",
    auditoireName: "L2 Droit",
    auditoireLevel: "L2",
    filiereName: "Droit",
    faculteName: "Faculte de Droit",
    schoolYearName: "2025-2026",
    schoolYearId: "sy1",
    organizationName: "Universite",
    branchName: "Campus",
    releveNumber: "UNIV-2026-RN-0001",
    semesters: [],
    overallAverage: 0,
  });
  assert.ok(pdf.blob.size > 0);
});

console.log("\nTous les tests Phase 7 (prod readiness) sont passes.");
