import assert from "node:assert/strict";

import {
  buildStudentAccessWhere,
  isAtelierBranchType,
  isAtelierImportableClass,
  secondaryCycleCurrentEnrollmentWhere,
} from "../lib/atelier-student-access";
import {
  canCreateStudentInBranch,
  requiresStudentImport,
  usesAttestationForBranch,
} from "../lib/branch-capabilities";
import {
  getBranchRouteRedirect,
  shouldHideSidebarHref,
} from "../lib/branch-route-guard";
import { generateAttestationPdf } from "../lib/pdf/attestation-layout";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("atelier exige import et bloque creation directe", () => {
  assert.equal(requiresStudentImport("ATELIER"), true);
  assert.equal(canCreateStudentInBranch("ATELIER"), false);
  assert.equal(isAtelierBranchType("ATELIER"), true);
});

test("atelier n importe que les humanites (pas tronc commun)", () => {
  const where = secondaryCycleCurrentEnrollmentWhere();
  assert.equal(where.statusEnrollment, true);
  assert.ok(Array.isArray(where.AND));
  const cycleFilter = where.AND?.[0] as {
    OR?: Array<{ classe?: { cycle?: string } }>;
  };
  assert.equal(cycleFilter.OR?.[0]?.classe?.cycle, "SECONDAIRE");
  const levelFilter = where.AND?.[1] as {
    classe?: { level?: { in?: string[] } };
  };
  assert.ok(levelFilter.classe?.level?.in?.includes("1è"));
  assert.equal(levelFilter.classe?.level?.in?.includes("7è"), false);
  assert.equal(levelFilter.classe?.level?.in?.includes("8è"), false);
});

test("atelier refuse tronc commun et accepte humanites", () => {
  assert.equal(
    isAtelierImportableClass({
      cycle: "SECONDAIRE",
      level: "1è",
      optionName: "Math-Physique",
    }),
    true,
  );
  assert.equal(
    isAtelierImportableClass({
      cycle: "SECONDAIRE",
      level: "7è",
      optionName: "Tronc commun",
      optionCode: "TRONC-COM",
    }),
    false,
  );
  assert.equal(
    isAtelierImportableClass({
      cycle: "SECONDAIRE",
      level: "8è",
      optionName: "Tronc commun",
    }),
    false,
  );
  assert.equal(
    isAtelierImportableClass({
      cycle: "PRIMAIRE",
      level: "6è",
    }),
    false,
  );
  assert.equal(
    isAtelierImportableClass({
      cycle: "SECONDAIRE",
      level: "7ª",
      optionName: "Núcleo comum",
    }),
    false,
  );
  assert.equal(
    isAtelierImportableClass({
      cycle: "SECONDAIRE",
      level: "9ª",
      optionName: "Electricidade",
    }),
    true,
  );
});

test("buildStudentAccessWhere autorise eleve natif ou lie", () => {
  const where = buildStudentAccessWhere("branch-atelier", "org-1");
  assert.equal(Array.isArray(where.OR), true);
  assert.equal(where.OR.length, 2);
});

test("route registration redirige vers student pour atelier", () => {
  const redirectPath = getBranchRouteRedirect(
    "/registration",
    "ATELIER",
    "org-1",
    "branch-atelier",
  );
  assert.equal(
    redirectPath,
    "/admin/organizations/org-1/branches/branch-atelier/student",
  );
});

test("attestations visibles seulement pour atelier", () => {
  assert.equal(usesAttestationForBranch("ATELIER"), true);
  assert.equal(usesAttestationForBranch("UNIVERSITE"), true);
  assert.equal(shouldHideSidebarHref("/admin/attestations", "SECONDAIRE"), true);
  assert.equal(shouldHideSidebarHref("/admin/attestations", "ATELIER"), false);
});

test("generateAttestationPdf est invocable", () => {
  assert.equal(typeof generateAttestationPdf, "function");
});

console.log("\nTous les tests Phase 3 (atelier) sont passes.");
