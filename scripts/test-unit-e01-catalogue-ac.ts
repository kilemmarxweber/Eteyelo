/**
 * Unit E01 — catalogue AC scolaire (P1).
 * Run: pnpm exec tsx scripts/test-unit-e01-catalogue-ac.ts
 */
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS,
  ORG_ROLE,
  accessControlStatements,
  organizationRoleStatements,
} from "../lib/permissions";
import {
  listCatalogPermissions,
  permissionLabelFr,
} from "../lib/permission-labels-fr";
import { listOrgRolePresetMetas } from "../lib/org/role-presets";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

const REQUIRED_RESOURCES = [
  "finance",
  "attendance",
  "notes",
  "results",
  "devoirs",
  "library",
  "fiches",
  "documents",
  "settings",
  "student",
  "teaching",
  "candidatures",
] as const;

test("catalogue déclare les ressources scolaires P1", () => {
  for (const resource of REQUIRED_RESOURCES) {
    assert.ok(
      resource in accessControlStatements,
      `manque resource ${resource}`,
    );
  }
});

test("finance expose encaisser ; teaching expose assign", () => {
  assert.ok(accessControlStatements.finance.includes("encaisser"));
  assert.ok(accessControlStatements.teaching.includes("assign"));
});

test("owner couvre finance + notes + student", () => {
  const owner = organizationRoleStatements[ORG_ROLE.OWNER];
  assert.ok(owner.finance?.includes("encaisser"));
  assert.ok(owner.notes?.includes("create"));
  assert.ok(owner.student?.includes("delete"));
});

test("gestionnaire a finance CRU+encaisser sans delete member", () => {
  const g = organizationRoleStatements[ORG_ROLE.GESTIONNAIRE];
  assert.ok(g.finance?.includes("encaisser"));
  assert.equal(g.finance?.includes("delete") ?? false, false);
  assert.equal(g.member?.includes("delete") ?? false, false);
});

test("chef d'établissement sans finance ; avec notes", () => {
  for (const slug of [ORG_ROLE.PREFET, ORG_ROLE.DIRECTEUR] as const) {
    const s = organizationRoleStatements[slug];
    assert.equal(s.finance, undefined);
    assert.ok(s.notes?.includes("update"));
    assert.ok(s.attendance?.includes("create"));
    assert.equal(s.settings, undefined);
    assert.equal(s.schoolYear, undefined);
    assert.equal(s.structureCopy, undefined);
    assert.ok(s.schoolCalendar?.includes("read"));
    assert.ok(s.publicCommunication?.includes("read"));
    assert.ok(s.periods?.includes("read"));
  }
});

test("directeur des études sans finance ; personnel read ; enseignants read", () => {
  const d = organizationRoleStatements[ORG_ROLE.DIRECTEUR_ETUDES];
  assert.equal(d.finance, undefined);
  assert.deepEqual(d.personnel, ["read"]);
  assert.deepEqual(d.teacher, ["read"]);
  assert.ok(d.notes?.includes("create"));
  assert.equal(d.settings, undefined);
  assert.equal(d.schoolYear, undefined);
  assert.equal(d.structureCopy, undefined);
  assert.ok(d.schoolCalendar?.includes("read"));
  assert.ok(d.publicCommunication?.includes("read"));
  assert.ok(d.periods?.includes("read"));
});

test("caissier finance+encaisser + inscription ; pas notes", () => {
  const c = organizationRoleStatements[ORG_ROLE.CAISSIER];
  assert.deepEqual(c.finance, ["create", "read", "update", "encaisser"]);
  assert.ok(c.inscription?.includes("create"));
  assert.equal(c.notes, undefined);
  assert.deepEqual(c.student, ["read"]);
});

test("teacher a notes/attendance ; pas finance", () => {
  const t = organizationRoleStatements[ORG_ROLE.TEACHER];
  assert.ok(t.notes?.includes("create"));
  assert.ok(t.attendance?.includes("create"));
  assert.equal(t.finance, undefined);
});

test("parent résultats read ; pas devoirs/library", () => {
  const p = organizationRoleStatements[ORG_ROLE.PARENT];
  assert.deepEqual(p.results, ["read"]);
  assert.equal(p.devoirs, undefined);
  assert.equal(p.library, undefined);
});

test("élève résultats + devoirs + library ; pas notes menu", () => {
  const s = organizationRoleStatements[ORG_ROLE.STUDENT];
  assert.deepEqual(s.results, ["read"]);
  assert.ok(s.devoirs?.includes("read"));
  assert.deepEqual(s.library, ["read"]);
  assert.equal(s.notes, undefined);
});

test("libellés FR finance encaisser", () => {
  assert.equal(permissionLabelFr("finance", "encaisser"), "Finance · Encaisser");
  assert.ok(listCatalogPermissions().length >= ALL_PERMISSIONS.length);
});

test("presets meta couvrent tous les slugs org", () => {
  const metas = listOrgRolePresetMetas();
  assert.ok(metas.some((m) => m.slug === ORG_ROLE.OWNER && m.locked));
  assert.equal(metas.length >= 11, true);
});

console.log("\nE01 catalogue AC scolaire — OK");
