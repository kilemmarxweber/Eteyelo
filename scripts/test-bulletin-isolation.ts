import assert from "node:assert/strict";

import { getAcademicStructure } from "../lib/academic-structure";
import {
  buildBulletinBranchContext,
  extractBulletinBranchLogo,
  resolveBulletinLayoutKind,
  resolveBulletinLogoUrl,
} from "../lib/bulletin-context";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

type BranchRecord = {
  id: string;
  organizationId: string;
  name: string;
  code?: string | null;
  adresse?: string | null;
  ville?: string | null;
  pays?: string | null;
  image?: unknown;
  typebranch?: unknown;
  organization: { name: string; logo?: string | null };
};

/** Reproduit le filtre `organizationId + branchId` de require-branch-context et fiches/page. */
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

const ORG_ID = "org-a";
const BRANCH_PRIMAIRE_ID = "branch-primaire";
const BRANCH_SECONDAIRE_ID = "branch-secondaire";
const OTHER_ORG_ID = "org-b";

const branches: BranchRecord[] = [
  {
    id: BRANCH_PRIMAIRE_ID,
    organizationId: ORG_ID,
    name: "École Primaire Gombe",
    code: "PRM-01",
    adresse: "12, Avenue Primaire",
    ville: "Kinshasa",
    pays: "RDC",
    image: JSON.stringify({ logo: "gombe-logo.png" }),
    typebranch: "PRIMAIRE",
    organization: { name: "Groupe Scolaire A", logo: "org-a-logo.png" },
  },
  {
    id: BRANCH_SECONDAIRE_ID,
    organizationId: ORG_ID,
    name: "Lycée Secondaire Limete",
    code: "SEC-02",
    adresse: "45, Boulevard Secondaire",
    ville: "Kinshasa",
    pays: "RDC",
    image: null,
    typebranch: "SECONDAIRE",
    organization: { name: "Groupe Scolaire A", logo: "org-a-logo.png" },
  },
  {
    id: "branch-other-org",
    organizationId: OTHER_ORG_ID,
    name: "Branche externe",
    typebranch: "SECONDAIRE",
    organization: { name: "Autre organisation" },
  },
];

test("Org A : branche primaire et secondaire coexistent sans mélange de données", () => {
  const primaire = resolveAuthorizedBranch(branches, ORG_ID, BRANCH_PRIMAIRE_ID);
  const secondaire = resolveAuthorizedBranch(
    branches,
    ORG_ID,
    BRANCH_SECONDAIRE_ID,
  );

  assert.ok(primaire);
  assert.ok(secondaire);

  const contextPrimaire = buildBulletinBranchContext(primaire);
  const contextSecondaire = buildBulletinBranchContext(secondaire);

  assert.equal(contextPrimaire.organizationName, contextSecondaire.organizationName);
  assert.notEqual(contextPrimaire.branchName, contextSecondaire.branchName);
  assert.notEqual(contextPrimaire.address, contextSecondaire.address);
  assert.equal(contextPrimaire.branchType, "PRIMAIRE");
  assert.equal(contextSecondaire.branchType, "SECONDAIRE");
});

test("Org A, branche primaire : layout primaire uniquement", () => {
  const branch = resolveAuthorizedBranch(branches, ORG_ID, BRANCH_PRIMAIRE_ID);
  assert.ok(branch);

  const context = buildBulletinBranchContext(branch);
  assert.equal(resolveBulletinLayoutKind(context.branchType), "primary");
  assert.equal(getAcademicStructure(context.branchType).groups.length, 3);
});

test("Org A, branche secondaire : layout secondaire uniquement", () => {
  const branch = resolveAuthorizedBranch(branches, ORG_ID, BRANCH_SECONDAIRE_ID);
  assert.ok(branch);

  const context = buildBulletinBranchContext(branch);
  assert.equal(resolveBulletinLayoutKind(context.branchType), "secondary");
  assert.equal(getAcademicStructure(context.branchType).groups.length, 2);
});

test("filtre organizationId + branchId : branche d'une autre organisation refusée", () => {
  const crossOrg = resolveAuthorizedBranch(
    branches,
    ORG_ID,
    "branch-other-org",
  );
  assert.equal(crossOrg, null);
});

test("filtre organizationId + branchId : branchId inconnu refusé", () => {
  const unknown = resolveAuthorizedBranch(branches, ORG_ID, "branch-inexistante");
  assert.equal(unknown, null);
});

test("changement d'URL : seule la branche de session est utilisée, pas le branchId de l'URL", () => {
  const sessionBranchId = BRANCH_PRIMAIRE_ID;
  const urlBranchId = BRANCH_SECONDAIRE_ID;

  const authorized = resolveAuthorizedBranch(branches, ORG_ID, sessionBranchId);
  const urlOnly = resolveAuthorizedBranch(branches, ORG_ID, urlBranchId);

  assert.ok(authorized);
  assert.ok(urlOnly);
  assert.notEqual(authorized.id, urlBranchId);

  const context = buildBulletinBranchContext(authorized);
  assert.equal(context.branchType, "PRIMAIRE");
  assert.equal(resolveBulletinLayoutKind(context.branchType), "primary");
  assert.notEqual(context.branchName, buildBulletinBranchContext(urlOnly).branchName);
});

test("typebranch manipulé côté client ignoré : le type vient du serveur", () => {
  const branch = resolveAuthorizedBranch(branches, ORG_ID, BRANCH_PRIMAIRE_ID);
  assert.ok(branch);

  const serverContext = buildBulletinBranchContext(branch);
  const clientTampered = {
    ...serverContext,
    branchType: "SECONDAIRE" as const,
  };

  assert.equal(serverContext.branchType, "PRIMAIRE");
  assert.equal(resolveBulletinLayoutKind(serverContext.branchType), "primary");
  assert.equal(resolveBulletinLayoutKind(clientTampered.branchType), "secondary");
  assert.notEqual(
    resolveBulletinLayoutKind(serverContext.branchType),
    resolveBulletinLayoutKind(clientTampered.branchType),
  );
});

test("en-tête primaire : nom, adresse et logo propres à la branche", () => {
  const branch = resolveAuthorizedBranch(branches, ORG_ID, BRANCH_PRIMAIRE_ID);
  assert.ok(branch);

  const context = buildBulletinBranchContext(branch);
  assert.equal(context.branchName, "École Primaire Gombe");
  assert.equal(context.branchCode, "PRM-01");
  assert.equal(context.address, "12, Avenue Primaire");
  assert.equal(context.city, "Kinshasa");
  assert.equal(context.logoUrl, "/uploads/gombe-logo.png");
});

test("en-tête secondaire : nom, adresse et logo de repli organisation", () => {
  const branch = resolveAuthorizedBranch(branches, ORG_ID, BRANCH_SECONDAIRE_ID);
  assert.ok(branch);

  const context = buildBulletinBranchContext(branch);
  assert.equal(context.branchName, "Lycée Secondaire Limete");
  assert.equal(context.branchCode, "SEC-02");
  assert.equal(context.address, "45, Boulevard Secondaire");
  assert.equal(context.logoUrl, "/uploads/org-a-logo.png");
});

test("logo de branche prioritaire sur logo d'organisation", () => {
  const branchLogo = extractBulletinBranchLogo(
    JSON.stringify({ logo: "branche.png" }),
  );
  const resolved = resolveBulletinLogoUrl(
    JSON.stringify({ logo: "branche.png" }),
    "org.png",
  );

  assert.equal(branchLogo, "/uploads/branche.png");
  assert.equal(resolved, "/uploads/branche.png");
});

test("requêtes fiches : classes et branche scopées par branchId de session", () => {
  const sessionBranchId = BRANCH_SECONDAIRE_ID;
  const classEnrollments = [
    { branchId: BRANCH_PRIMAIRE_ID, classeId: "classe-primaire" },
    { branchId: BRANCH_SECONDAIRE_ID, classeId: "classe-secondaire" },
    { branchId: BRANCH_SECONDAIRE_ID, classeId: "classe-secondaire-2" },
  ];

  const scoped = classEnrollments.filter(
    (enrollment) => enrollment.branchId === sessionBranchId,
  );

  assert.equal(scoped.length, 2);
  assert.ok(scoped.every((item) => item.branchId === sessionBranchId));
  assert.ok(
    scoped.every((item) => item.classeId.startsWith("classe-secondaire")),
  );
});

test("aucune fuite de format : périodes primaires distinctes des périodes secondaires", () => {
  const primaire = buildBulletinBranchContext(
    resolveAuthorizedBranch(branches, ORG_ID, BRANCH_PRIMAIRE_ID)!,
  );
  const secondaire = buildBulletinBranchContext(
    resolveAuthorizedBranch(branches, ORG_ID, BRANCH_SECONDAIRE_ID)!,
  );

  const primaryPeriods = getAcademicStructure(primaire.branchType).periods.map(
    (period) => period.key,
  );
  const secondaryPeriods = getAcademicStructure(secondaire.branchType).periods.map(
    (period) => period.key,
  );

  assert.deepEqual(primaryPeriods, [
    "p1",
    "p2",
    "exam1",
    "p3",
    "p4",
    "exam2",
    "p5",
    "p6",
    "exam3",
  ]);
  assert.deepEqual(secondaryPeriods, [
    "p1",
    "p2",
    "exam1",
    "p3",
    "p4",
    "exam2",
  ]);
  assert.ok(primaryPeriods.includes("exam3"));
  assert.ok(!secondaryPeriods.includes("exam3"));
});

console.log("\n12 tests d'isolation et de sélection du bulletin réussis.");
