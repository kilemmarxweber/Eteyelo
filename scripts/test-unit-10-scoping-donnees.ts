/**
 * Smoke tests — unit-10 scoping données (périmètre métier par rôle).
 */
import assert from "node:assert/strict";

import {
  assertStudentIdInScope,
  isCursusSelfScopedRole,
  resolveCursusViewerRole,
} from "../lib/auth/cursus-scope";
import {
  canAccessFinanceArea,
  canAccessTeachingArea,
  canManageOrganization,
} from "../lib/auth/session-roles";
import { ORG_ROLE } from "../lib/permissions";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function sessionWithOrgRole(role: string) {
  return { organization: { role } };
}

const sessionStudent = sessionWithOrgRole(ORG_ROLE.STUDENT);
const sessionParent = sessionWithOrgRole(ORG_ROLE.PARENT);
const sessionTeacher = sessionWithOrgRole(ORG_ROLE.TEACHER);
const sessionCaissier = sessionWithOrgRole(ORG_ROLE.CAISSIER);
const sessionDirecteur = sessionWithOrgRole(ORG_ROLE.DIRECTEUR);
const sessionPrefet = sessionWithOrgRole(ORG_ROLE.PREFET);
const sessionEtudes = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);

test("élève / parent = self-scoped cursus", () => {
  assert.equal(resolveCursusViewerRole(sessionStudent), "student");
  assert.equal(resolveCursusViewerRole(sessionParent), "parent");
  assert.equal(isCursusSelfScopedRole("student"), true);
  assert.equal(isCursusSelfScopedRole("parent"), true);
  assert.equal(isCursusSelfScopedRole("teacher"), false);
});

test("assertStudentIdInScope rejette un id hors périmètre", () => {
  assert.throws(
    () => assertStudentIdInScope("alien", ["self-a"]),
    (err: unknown) =>
      err instanceof Error &&
      (/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND|notFound/i.test(err.message) ||
        /NEXT_HTTP_ERROR_FALLBACK;404/i.test(String((err as { digest?: string }).digest ?? ""))),
  );
  assert.doesNotThrow(() => assertStudentIdInScope("self-a", ["self-a", "child-b"]));
});

test("enseignant : teaching oui, pas finance (pas de note hors affectation côté gate)", () => {
  assert.equal(canAccessTeachingArea(sessionTeacher), true);
  assert.equal(canAccessFinanceArea(sessionTeacher), false);
  assert.equal(canManageOrganization(sessionTeacher), false);
});

test("caissier : finance oui, manage org non (pas maj dossier scolaire)", () => {
  assert.equal(canAccessFinanceArea(sessionCaissier), true);
  assert.equal(canManageOrganization(sessionCaissier), false);
});

test("chef établissement (directeur/prefet) : finance + manage", () => {
  assert.equal(canAccessFinanceArea(sessionDirecteur), true);
  assert.equal(canAccessFinanceArea(sessionPrefet), true);
  assert.equal(canManageOrganization(sessionDirecteur), true);
  assert.equal(canManageOrganization(sessionPrefet), true);
});

test("directeur des études : pas de finance (même URL forcée / profil)", () => {
  assert.equal(canAccessFinanceArea(sessionEtudes), false);
  assert.equal(canManageOrganization(sessionEtudes), true);
});

console.log("\nAll unit-10 data-scoping smoke tests passed.");
