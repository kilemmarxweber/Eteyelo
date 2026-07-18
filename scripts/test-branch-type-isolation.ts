import assert from "node:assert/strict";

import { getAcademicStructure, normalizeBranchType } from "../lib/academic-structure";
import {
  buildBulletinBranchContext,
  resolveBulletinLayoutKind,
} from "../lib/bulletin-context";
import {
  getBranchCapabilities,
  getClassDisplayLabel,
  getClassDisplayLabelPlural,
  hidesParentManagement,
  isUniversiteBranch,
  usesAttestationForBranch,
  usesBrevetForBranch,
  usesBulletinForBranch,
  usesFinanceForBranch,
  usesReleveForBranch,
  usesUniversityLmdFeatures,
} from "../lib/branch-capabilities";
import {
  getBranchRouteRedirect,
  shouldHideSidebarHref,
} from "../lib/branch-route-guard";
import { getBranchTypeHelpContent } from "../lib/branch-type-help";
import { supportsCourseImport } from "../lib/extended-course-import";
import { getPeopleLabels } from "../lib/people-labels";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

type BranchRecord = {
  id: string;
  organizationId: string;
  name: string;
  typebranch: unknown;
  organization: { name: string; logo?: string | null };
};

const ORG_ID = "org-multi";
const BRANCHES: BranchRecord[] = [
  {
    id: "branch-primaire",
    organizationId: ORG_ID,
    name: "Primaire",
    typebranch: "PRIMAIRE",
    organization: { name: "Org Multi" },
  },
  {
    id: "branch-secondaire",
    organizationId: ORG_ID,
    name: "Secondaire",
    typebranch: "SECONDAIRE",
    organization: { name: "Org Multi" },
  },
  {
    id: "branch-atelier",
    organizationId: ORG_ID,
    name: "Atelier",
    typebranch: "ATELIER",
    organization: { name: "Org Multi" },
  },
  {
    id: "branch-centre",
    organizationId: ORG_ID,
    name: "Centre",
    typebranch: "CENTRE_FORMATION",
    organization: { name: "Org Multi" },
  },
  {
    id: "branch-universite",
    organizationId: ORG_ID,
    name: "Universite",
    typebranch: "UNIVERSITE",
    organization: { name: "Org Multi" },
  },
];

function resolveAuthorizedBranch(
  branches: BranchRecord[],
  organizationId: string,
  branchId: string,
): BranchRecord | null {
  return (
    branches.find(
      (branch) => branch.id === branchId && branch.organizationId === organizationId,
    ) ?? null
  );
}

test("5 types coexistent dans la meme organisation sans melange de contexte", () => {
  const contexts = BRANCHES.map((branch) =>
    buildBulletinBranchContext(
      resolveAuthorizedBranch(BRANCHES, ORG_ID, branch.id)!,
    ),
  );

  assert.equal(contexts.length, 5);
  assert.equal(new Set(contexts.map((ctx) => ctx.branchType)).size, 5);
  assert.ok(
    contexts.every((ctx) => ctx.organizationName === "Org Multi"),
  );
});

test("primaire et secondaire : bulletins inchanges", () => {
  assert.equal(usesBulletinForBranch("PRIMAIRE"), true);
  assert.equal(usesBulletinForBranch("SECONDAIRE"), true);
  assert.equal(resolveBulletinLayoutKind("PRIMAIRE"), "primary");
  assert.equal(resolveBulletinLayoutKind("SECONDAIRE"), "secondary");
  assert.equal(getAcademicStructure("PRIMAIRE").periods.length, 9);
  assert.equal(getAcademicStructure("SECONDAIRE").periods.length, 6);
});

test("atelier : attestations uniquement, pas bulletin ni brevet", () => {
  assert.equal(usesAttestationForBranch("ATELIER"), true);
  assert.equal(usesBulletinForBranch("ATELIER"), false);
  assert.equal(usesBrevetForBranch("ATELIER"), false);
  assert.equal(usesFinanceForBranch("ATELIER"), false);
});

test("centre : brevet sans bulletin", () => {
  assert.equal(usesBrevetForBranch("CENTRE_FORMATION"), true);
  assert.equal(usesBulletinForBranch("CENTRE_FORMATION"), false);
  assert.equal(usesReleveForBranch("CENTRE_FORMATION"), false);
});

test("universite : releve et attestations, pas bulletin", () => {
  assert.equal(usesReleveForBranch("UNIVERSITE"), true);
  assert.equal(usesAttestationForBranch("UNIVERSITE"), true);
  assert.equal(usesBulletinForBranch("UNIVERSITE"), false);
  assert.equal(usesBrevetForBranch("UNIVERSITE"), false);
});

test("routes documents isolees par type de branche", () => {
  const org = ORG_ID;
  const base = "branch-x";

  assert.ok(
    getBranchRouteRedirect("/brevets", "SECONDAIRE", org, base)?.includes("/results"),
  );
  assert.equal(getBranchRouteRedirect("/brevets", "CENTRE_FORMATION", org, base), null);

  assert.ok(
    getBranchRouteRedirect("/releves", "SECONDAIRE", org, base)?.includes("/results"),
  );
  assert.equal(getBranchRouteRedirect("/releves", "UNIVERSITE", org, base), null);

  assert.ok(
    getBranchRouteRedirect("/attestations", "SECONDAIRE", org, base)?.includes("/results"),
  );
  assert.equal(getBranchRouteRedirect("/attestations", "ATELIER", org, base), null);
});

test("sidebar : entrees specifiques masquees hors type compatible", () => {
  assert.equal(shouldHideSidebarHref("/admin/fiches", "UNIVERSITE"), true);
  assert.equal(shouldHideSidebarHref("/admin/fiches", "SECONDAIRE"), false);
  assert.equal(shouldHideSidebarHref("/admin/brevets", "CENTRE_FORMATION"), false);
  assert.equal(shouldHideSidebarHref("/admin/brevets", "ATELIER"), true);
  assert.equal(shouldHideSidebarHref("/admin/releves", "UNIVERSITE"), false);
  assert.equal(shouldHideSidebarHref("/admin/help", "ATELIER"), false);
});

test("normalizeBranchType : valeur inconnue retombe sur SECONDAIRE", () => {
  assert.equal(normalizeBranchType(null), "SECONDAIRE");
  assert.equal(normalizeBranchType("INVALID"), "SECONDAIRE");
  assert.equal(normalizeBranchType("PRIMAIRE"), "PRIMAIRE");
});

test("aide contextuelle disponible pour chaque type", () => {
  for (const branch of BRANCHES) {
    const help = getBranchTypeHelpContent(branch.typebranch);
    assert.ok(help.typeLabel.length > 0);
    assert.ok(help.summary.length > 0);
    assert.ok(help.sections.length > 0);
    assert.ok(help.quickLinks.length > 0);
  }
});

test("capacites distinctes : aucun chevauchement bulletin/brevet/releve scolaire", () => {
  for (const branch of BRANCHES) {
    const caps = getBranchCapabilities(branch.typebranch);
    if (caps.usesBulletin) {
      assert.equal(caps.usesReleve, false);
      assert.equal(caps.usesBrevet, false);
    }
    if (caps.usesReleve) {
      assert.equal(caps.usesBulletin, false);
    }
  }
});

const NON_UNIVERSITY_TYPES = [
  "PRIMAIRE",
  "SECONDAIRE",
  "ATELIER",
  "CENTRE_FORMATION",
] as const;

test("libelles ESU (Etudiant, Professeur, Auditoire) reserves a UNIVERSITE", () => {
  const uniPeople = getPeopleLabels("UNIVERSITE");
  assert.equal(uniPeople.student, "Étudiant");
  assert.equal(uniPeople.teacher, "Professeur");
  assert.equal(getClassDisplayLabel("UNIVERSITE"), "Auditoire");
  assert.equal(getClassDisplayLabelPlural("UNIVERSITE"), "Auditoires");

  for (const typebranch of NON_UNIVERSITY_TYPES) {
    const people = getPeopleLabels(typebranch);
    assert.notEqual(people.student, "Étudiant", `${typebranch} ne doit pas afficher Etudiant`);
    assert.notEqual(people.teacher, "Professeur", `${typebranch} ne doit pas afficher Professeur`);
    assert.notEqual(getClassDisplayLabel(typebranch), "Auditoire", `${typebranch} ne doit pas afficher Auditoire`);
    assert.notEqual(getClassDisplayLabelPlural(typebranch), "Auditoires", `${typebranch} ne doit pas afficher Auditoires`);
  }
});

test("calendrier LMD : uniquement UNIVERSITE", () => {
  const uniStructure = getAcademicStructure("UNIVERSITE");
  assert.equal(uniStructure.groups[0]?.label, "Premier semestre");
  assert.ok(
    uniStructure.periods.some((period) => period.label.includes("Première session")),
  );
  assert.ok(
    !uniStructure.periods.some((period) => period.label.includes("Délibérations")),
  );

  const secondaryStructure = getAcademicStructure("SECONDAIRE");
  assert.equal(secondaryStructure.groups[0]?.label, "Semestre 1");
  assert.ok(secondaryStructure.periods.some((period) => period.label.includes("1ere Periode")));
  assert.ok(!secondaryStructure.periods.some((period) => period.label.includes("Délibérations")));

  for (const typebranch of NON_UNIVERSITY_TYPES) {
    assert.equal(usesUniversityLmdFeatures(typebranch), false);
    assert.notEqual(getAcademicStructure(typebranch).groups[0]?.label, "Premier semestre");
  }
});

test("import cours et auditoire obligatoire : reserves a UNIVERSITE", () => {
  assert.equal(supportsCourseImport("UNIVERSITE"), true);
  for (const typebranch of NON_UNIVERSITY_TYPES) {
    assert.equal(supportsCourseImport(typebranch), false);
  }
});

test("parents masques : atelier et universite seulement", () => {
  assert.equal(hidesParentManagement("UNIVERSITE"), true);
  assert.equal(hidesParentManagement("ATELIER"), true);
  assert.equal(hidesParentManagement("PRIMAIRE"), false);
  assert.equal(hidesParentManagement("SECONDAIRE"), false);
  assert.equal(hidesParentManagement("CENTRE_FORMATION"), false);
});

test("isUniversiteBranch : garde explicite pour les features ESU", () => {
  assert.equal(isUniversiteBranch("UNIVERSITE"), true);
  for (const typebranch of NON_UNIVERSITY_TYPES) {
    assert.equal(isUniversiteBranch(typebranch), false);
  }
});

console.log("\n15 tests d'isolation inter-types de branche reussis.");
