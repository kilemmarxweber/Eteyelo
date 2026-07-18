import assert from "node:assert/strict";

import { getAcademicStructure } from "../lib/academic-structure";
import {
  canCreateStudentInBranch,
  getClassDisplayLabelPlural,
  usesBulletinForBranch,
  usesFinanceForBranch,
  usesPonderationForBranch,
  usesSectionOptionForBranch,
} from "../lib/branch-capabilities";
import {
  getBranchRouteRedirect,
  isBranchRouteAllowed,
  shouldHideSidebarHref,
} from "../lib/branch-route-guard";
import { buildStaticSideLinks } from "../lib/sidebar-menu";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

const ORG_ID = "org-test";
const BRANCH_ID = "branch-test";

test("atelier masque sections, fiches, ponderations et finance", () => {
  assert.equal(shouldHideSidebarHref("/admin/section", "ATELIER"), true);
  assert.equal(shouldHideSidebarHref("/admin/fiches", "ATELIER"), true);
  assert.equal(shouldHideSidebarHref("/admin/coursPonderationOption", "ATELIER"), true);
  assert.equal(shouldHideSidebarHref("/admin/frais", "ATELIER"), true);
  assert.equal(usesFinanceForBranch("ATELIER"), false);
});

test("universite autorise sections mais pas bulletins", () => {
  assert.equal(usesSectionOptionForBranch("UNIVERSITE"), true);
  assert.equal(usesBulletinForBranch("UNIVERSITE"), false);
  assert.equal(shouldHideSidebarHref("/admin/fiches", "UNIVERSITE"), true);
  assert.equal(shouldHideSidebarHref("/admin/section", "UNIVERSITE"), true);
  assert.equal(shouldHideSidebarHref("/admin/programmes", "UNIVERSITE"), false);
});

test("centre de formation autorise ponderations et finance", () => {
  assert.equal(usesPonderationForBranch("CENTRE_FORMATION"), true);
  assert.equal(usesFinanceForBranch("CENTRE_FORMATION"), true);
  assert.equal(shouldHideSidebarHref("/admin/coursPonderationOption", "CENTRE_FORMATION"), false);
});

test("route guard redirige fiches vers results pour universite", () => {
  const redirectPath = getBranchRouteRedirect(
    "/fiches",
    "UNIVERSITE",
    ORG_ID,
    BRANCH_ID,
  );

  assert.equal(
    redirectPath,
    `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}/results`,
  );
  assert.equal(isBranchRouteAllowed("/fiches", "SECONDAIRE"), true);
});

test("route guard redirige section vers classe pour atelier", () => {
  const redirectPath = getBranchRouteRedirect(
    "/section",
    "ATELIER",
    ORG_ID,
    BRANCH_ID,
  );

  assert.equal(
    redirectPath,
    `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}/classe`,
  );
});

test("sidebar renomme classe en auditoire pour universite", () => {
  const links = buildStaticSideLinks(
    {
      user: { role: "owner" },
      organization: { role: "owner" },
      branch: { typebranch: "UNIVERSITE" },
    },
    `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}/classe`,
    "UNIVERSITE",
  );

  const classesMenu = links
    .flatMap((item) => item.sub ?? [])
    .find((item) => item.href.endsWith("/classe"));

  assert.equal(classesMenu?.title, "Auditoires");
});

test("sidebar masque finance pour atelier", () => {
  const links = buildStaticSideLinks(
    {
      user: { role: "owner" },
      organization: { role: "owner" },
      branch: { typebranch: "ATELIER" },
    },
    `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}`,
    "ATELIER",
  );

  const financeMenu = links.find((item) => item.title === "Finance");
  assert.equal(financeMenu, undefined);
});

test("structures academiques bootstrap par type", () => {
  assert.equal(getAcademicStructure("ATELIER").groups[0]?.label, "Session");
  assert.equal(getAcademicStructure("CENTRE_FORMATION").groups.length, 2);
  assert.equal(getAcademicStructure("UNIVERSITE").groups.length, 2);
});

test("libelles pluriels de classes par type", () => {
  assert.equal(getClassDisplayLabelPlural("UNIVERSITE"), "Auditoires");
  assert.equal(getClassDisplayLabelPlural("ATELIER"), "Groupes");
  assert.equal(getClassDisplayLabelPlural("CENTRE_FORMATION"), "Sessions");
});

test("politique eleves atelier vs centre", () => {
  assert.equal(canCreateStudentInBranch("ATELIER"), false);
  assert.equal(canCreateStudentInBranch("CENTRE_FORMATION"), true);
});

console.log("\nTous les tests Phase 2 sont passes.");
