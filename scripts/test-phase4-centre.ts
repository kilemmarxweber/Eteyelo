import assert from "node:assert/strict";

import {
  canCreateStudentInBranch,
  requiresStudentImport,
  usesBrevetForBranch,
} from "../lib/branch-capabilities";
import {
  getBranchRouteRedirect,
  shouldHideSidebarHref,
} from "../lib/branch-route-guard";
import {
  supportsOptionalStudentImport,
  isLinkOnlyBranch,
} from "../lib/extended-student-import";
import { generateBrevetPdf } from "../lib/pdf/brevet-layout";
import { hidesParentManagement, hidesProvenanceEcole } from "../lib/branch-capabilities";
import {
  buildCentreSystemParentAddress,
  buildCentreSystemParentEmail,
  buildCentreSystemParentUsername,
} from "../lib/centre-default-parent";
import { getTrainingLabels, usesTrainingLabels } from "../lib/training-labels";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("centre autorise creation et import optionnel", () => {
  assert.equal(canCreateStudentInBranch("CENTRE_FORMATION"), true);
  assert.equal(requiresStudentImport("CENTRE_FORMATION"), false);
  assert.equal(supportsOptionalStudentImport("CENTRE_FORMATION"), true);
  assert.equal(isLinkOnlyBranch("CENTRE_FORMATION"), false);
});

test("atelier reste en import obligatoire uniquement", () => {
  assert.equal(requiresStudentImport("ATELIER"), true);
  assert.equal(isLinkOnlyBranch("ATELIER"), true);
  assert.equal(supportsOptionalStudentImport("ATELIER"), true);
});

test("brevets reserves au centre de formation", () => {
  assert.equal(usesBrevetForBranch("CENTRE_FORMATION"), true);
  assert.equal(usesBrevetForBranch("ATELIER"), false);
  assert.equal(usesBrevetForBranch("UNIVERSITE"), false);
});

test("routes brevets et programmes protegees par type", () => {
  const brevetRedirect = getBranchRouteRedirect(
    "/brevets",
    "SECONDAIRE",
    "org-1",
    "branch-1",
  );
  assert.equal(
    brevetRedirect,
    "/admin/organizations/org-1/branches/branch-1/results",
  );

  const programmesAllowed = getBranchRouteRedirect(
    "/programmes",
    "CENTRE_FORMATION",
    "org-1",
    "branch-centre",
  );
  assert.equal(programmesAllowed, null);
});

test("sidebar centre affiche programmes/modules et brevets", () => {
  assert.equal(usesTrainingLabels("CENTRE_FORMATION"), true);
  assert.equal(shouldHideSidebarHref("/admin/section", "CENTRE_FORMATION"), true);
  assert.equal(shouldHideSidebarHref("/admin/programmes", "CENTRE_FORMATION"), false);
  assert.equal(shouldHideSidebarHref("/admin/modules", "CENTRE_FORMATION"), false);
  assert.equal(shouldHideSidebarHref("/admin/brevets", "CENTRE_FORMATION"), false);
  assert.equal(shouldHideSidebarHref("/admin/brevets", "SECONDAIRE"), true);
});

test("libelles centre de formation", () => {
  const labels = getTrainingLabels("CENTRE_FORMATION");
  assert.equal(labels.programmesMenu, "Programmes");
  assert.equal(labels.modulesMenu, "Modules");
  assert.match(labels.sectionTitle, /Programmes/i);
});

test("generateBrevetPdf est invocable", () => {
  assert.equal(typeof generateBrevetPdf, "function");
});

test("centre masque la gestion des parents", () => {
  assert.equal(hidesParentManagement("CENTRE_FORMATION"), true);
  assert.equal(hidesProvenanceEcole("CENTRE_FORMATION"), true);
  assert.equal(hidesProvenanceEcole("SECONDAIRE"), false);
  assert.match(buildCentreSystemParentEmail("branch-centre-1"), /branch-centre-1/);
  assert.match(buildCentreSystemParentUsername("branch-centre-1"), /^parent\.systeme\./);
  assert.equal(
    buildCentreSystemParentAddress({
      branchName: "CFPA Kinshasa",
      adresse: "12 Av. de la Formation",
      commune: "Gombe",
      ville: "Kinshasa",
      province: "Kinshasa",
      pays: "RDC",
    }),
    "12 Av. de la Formation, Gombe, Kinshasa, Kinshasa, RDC",
  );
  assert.equal(
    buildCentreSystemParentAddress({
      branchName: "CFPA Kinshasa",
      ville: "Kinshasa",
    }),
    "Kinshasa",
  );
});

console.log("\nTous les tests Phase 4 (centre) sont passes.");
