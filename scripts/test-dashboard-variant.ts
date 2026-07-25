import assert from "node:assert/strict";

import {
  getDashboardDataBlocks,
  resolveDashboardVariant,
} from "../lib/auth/dashboard-variant";
import { ORG_ROLE } from "../lib/permissions";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function sessionWithOrgRole(role: string) {
  return { organization: { role } };
}

test("préfet / directeur → pilotage + finance (même variante)", () => {
  for (const role of [ORG_ROLE.PREFET, ORG_ROLE.DIRECTEUR] as const) {
    const variant = resolveDashboardVariant(sessionWithOrgRole(role));
    assert.equal(variant, "directeur");
    const blocks = getDashboardDataBlocks(variant);
    assert.equal(blocks.schoolStats, true);
    assert.equal(blocks.revenue, true);
    assert.equal(blocks.pedagogyMetrics, true);
    assert.equal(blocks.cashier, false);
  }
});

test("directeur des études → pédagogique sans finance", () => {
  const variant = resolveDashboardVariant(
    sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES),
  );
  assert.equal(variant, "directeur_etudes");
  const blocks = getDashboardDataBlocks(variant);
  assert.equal(blocks.schoolStats, true);
  assert.equal(blocks.revenue, false);
  assert.equal(blocks.pedagogyMetrics, true);
  assert.equal(blocks.cashier, false);
});

test("gestionnaire / owner → vue directeur+", () => {
  assert.equal(
    resolveDashboardVariant(sessionWithOrgRole(ORG_ROLE.GESTIONNAIRE)),
    "directeur",
  );
  assert.equal(
    resolveDashboardVariant(sessionWithOrgRole(ORG_ROLE.OWNER)),
    "directeur",
  );
});

test("caissier → caisse sans stats pédagogiques", () => {
  const variant = resolveDashboardVariant(
    sessionWithOrgRole(ORG_ROLE.CAISSIER),
  );
  assert.equal(variant, "caissier");
  const blocks = getDashboardDataBlocks(variant);
  assert.equal(blocks.cashier, true);
  assert.equal(blocks.schoolStats, false);
  assert.equal(blocks.pedagogyMetrics, false);
  assert.equal(blocks.revenue, false);
  assert.equal(blocks.teacher, false);
  assert.equal(blocks.student, false);
});

test("enseignant → mes classes sans finance", () => {
  const variant = resolveDashboardVariant(sessionWithOrgRole(ORG_ROLE.TEACHER));
  assert.equal(variant, "teacher");
  const blocks = getDashboardDataBlocks(variant);
  assert.equal(blocks.teacher, true);
  assert.equal(blocks.revenue, false);
  assert.equal(blocks.schoolStats, false);
  assert.equal(blocks.cashier, false);
});

test("élève → personnel sans KPI admin", () => {
  const variant = resolveDashboardVariant(sessionWithOrgRole(ORG_ROLE.STUDENT));
  assert.equal(variant, "student");
  const blocks = getDashboardDataBlocks(variant);
  assert.equal(blocks.student, true);
  assert.equal(blocks.schoolStats, false);
  assert.equal(blocks.pedagogyMetrics, false);
  assert.equal(blocks.revenue, false);
});

test("parent → foyer + feedback", () => {
  const variant = resolveDashboardVariant(sessionWithOrgRole(ORG_ROLE.PARENT));
  assert.equal(variant, "parent");
  const blocks = getDashboardDataBlocks(variant);
  assert.equal(blocks.parent, true);
  assert.equal(blocks.parentFeedback, true);
  assert.equal(blocks.schoolStats, false);
  assert.equal(blocks.pedagogyMetrics, false);
});

console.log("\nAll dashboard-variant smoke tests passed.");
