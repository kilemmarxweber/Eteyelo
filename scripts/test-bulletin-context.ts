import assert from "node:assert/strict";

import { buildBulletinBranchContext } from "../lib/bulletin-context";

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
    organization: { name: "Écoles Exemple" },
  });
  const branchB = buildBulletinBranchContext({
    name: "Branche Limete",
    code: "LIM-02",
    adresse: "Boulevard B, 20",
    ville: "Kinshasa",
    pays: "RDC",
    organization: { name: "Écoles Exemple" },
  });

  assert.equal(branchA.organizationName, branchB.organizationName);
  assert.notEqual(branchA.branchName, branchB.branchName);
  assert.notEqual(branchA.branchCode, branchB.branchCode);
  assert.notEqual(branchA.address, branchB.address);
});

test("nom, code et adresse correspondent à la branche sélectionnée", () => {
  const context = buildBulletinBranchContext({
    name: "  Institut Central  ",
    code: "  IC-2026  ",
    adresse: "  15, Avenue Centrale  ",
    ville: "  Matadi  ",
    pays: "  RDC  ",
    organization: { name: "  Groupe Scolaire  " },
  });

  assert.deepEqual(context, {
    organizationName: "Groupe Scolaire",
    branchName: "Institut Central",
    branchCode: "IC-2026",
    address: "15, Avenue Centrale",
    city: "Matadi",
    country: "RDC",
    logoUrl: "",
  });
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

console.log("\n6 tests du contexte et de l’en-tête du bulletin réussis.");
