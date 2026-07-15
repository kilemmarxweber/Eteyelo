import assert from "node:assert/strict";

import {
  buildBulletinBranchContext,
  resolveBulletinLayoutKind,
} from "../lib/bulletin-context";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

test("deux branches de la même organisation gardent leurs propres données", () => {
  const branchA = buildBulletinBranchContext({
    name: "Branche Gombe",
    code: "GOM-01",
    adresse: "Avenue A, 10",
    ville: "Kinshasa",
    pays: "RDC",
    typebranch: "SECONDAIRE",
    organization: { name: "Écoles Exemple" },
  });
  const branchB = buildBulletinBranchContext({
    name: "Branche Limete",
    code: "LIM-02",
    adresse: "Boulevard B, 20",
    ville: "Kinshasa",
    pays: "RDC",
    typebranch: "PRIMAIRE",
    organization: { name: "Écoles Exemple" },
  });

  assert.equal(branchA.organizationName, branchB.organizationName);
  assert.notEqual(branchA.branchName, branchB.branchName);
  assert.notEqual(branchA.branchCode, branchB.branchCode);
  assert.notEqual(branchA.address, branchB.address);
  assert.equal(branchA.branchType, "SECONDAIRE");
  assert.equal(branchB.branchType, "PRIMAIRE");
});

test("nom, code et adresse correspondent à la branche sélectionnée", () => {
  const context = buildBulletinBranchContext({
    name: "  Institut Central  ",
    code: "  IC-2026  ",
    adresse: "  15, Avenue Centrale  ",
    ville: "  Matadi  ",
    pays: "  RDC  ",
    typebranch: "SECONDAIRE",
    organization: { name: "  Groupe Scolaire  " },
  });

  assert.deepEqual(context, {
    organizationName: "Groupe Scolaire",
    branchName: "Institut Central",
    branchCode: "IC-2026",
    address: "15, Avenue Centrale",
    province: "",
    city: "Matadi",
    commune: "",
    country: "RDC",
    logoUrl: "",
    branchType: "SECONDAIRE",
  });
});

test("branche PRIMAIRE : branchType normalisé", () => {
  const context = buildBulletinBranchContext({
    name: "École Primaire",
    typebranch: "PRIMAIRE",
    organization: { name: "Organisation" },
  });

  assert.equal(context.branchType, "PRIMAIRE");
});

test("branche SECONDAIRE : branchType normalisé", () => {
  const context = buildBulletinBranchContext({
    name: "Lycée Secondaire",
    typebranch: "SECONDAIRE",
    organization: { name: "Organisation" },
  });

  assert.equal(context.branchType, "SECONDAIRE");
});

test("typebranch invalide ou absent : repli sur SECONDAIRE", () => {
  const withoutType = buildBulletinBranchContext({
    name: "École",
    organization: { name: "Organisation" },
  });
  const invalidType = buildBulletinBranchContext({
    name: "École",
    typebranch: "INVALIDE",
    organization: { name: "Organisation" },
  });

  assert.equal(withoutType.branchType, "SECONDAIRE");
  assert.equal(invalidType.branchType, "SECONDAIRE");
});

test("resolveBulletinLayoutKind : PRIMAIRE → primary", () => {
  assert.equal(resolveBulletinLayoutKind("PRIMAIRE"), "primary");
});

test("resolveBulletinLayoutKind : SECONDAIRE → secondary", () => {
  assert.equal(resolveBulletinLayoutKind("SECONDAIRE"), "secondary");
});

test("resolveBulletinLayoutKind : valeur inconnue → secondary (repli)", () => {
  assert.equal(resolveBulletinLayoutKind(undefined), "secondary");
  assert.equal(resolveBulletinLayoutKind("LYCEE"), "secondary");
});

test("branche sans code : valeur vide et aucun libellé erroné", () => {
  const context = buildBulletinBranchContext({
    name: "École Sans Code",
    code: null,
    organization: { name: "Organisation" },
  });

  assert.equal(context.branchCode, "");
});

test("branche sans adresse : valeur vide", () => {
  const context = buildBulletinBranchContext({
    name: "École Sans Adresse",
    adresse: null,
    organization: { name: "Organisation" },
  });

  assert.equal(context.address, "");
});

test("branche sans ville ni pays : valeurs vides", () => {
  const context = buildBulletinBranchContext({
    name: "École",
    ville: null,
    pays: null,
    organization: { name: "Organisation" },
  });

  assert.equal(context.city, "");
  assert.equal(context.country, "");
  assert.equal(context.province, "");
  assert.equal(context.commune, "");
});

test("province et commune sont exposées dans le contexte bulletin", () => {
  const context = buildBulletinBranchContext({
    name: "École Primaire",
    province: "  Kinshasa / Lukunga  ",
    ville: "Kinshasa",
    commune: "  Selembao  ",
    typebranch: "PRIMAIRE",
    organization: { name: "Organisation" },
  });

  assert.equal(context.province, "Kinshasa / Lukunga");
  assert.equal(context.commune, "Selembao");
  assert.equal(context.city, "Kinshasa");
});

test("absence de logo dynamique n’empêche pas la création du contexte", () => {
  const context = buildBulletinBranchContext({
    name: "École",
    image: null,
    organization: { name: "Organisation", logo: null },
  });

  assert.equal(context.logoUrl, "");
  assert.equal(context.branchName, "École");
});

console.log("\n13 tests du contexte et de l’en-tête du bulletin réussis.");
