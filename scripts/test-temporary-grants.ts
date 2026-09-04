/**
 * Octrois temporaires — matching strict ressource/action et entrée de zone.
 */
import assert from "node:assert/strict";

import {
  expandTemporaryGrantActions,
  grantMatchesPermission,
  grantsCoverBranchArea,
  grantsCoverPermissions,
} from "../lib/auth/temporary-privilege";
import { grantsAllowWrite } from "../lib/auth/temporary-grant-actions";
import { grantResourceForArea } from "../lib/auth/branch-area-permissions";
import {
  GRANT_GROUP_ALL,
  buildTemporaryGrantPairs,
  resolveTemporaryGrantResources,
} from "../lib/auth/temporary-grant-catalog";
import { normalizeSelectedGrantActions } from "../lib/auth/temporary-grant-actions";
import {
  isGrantedWorkspacePage,
  pageStillAllowedAfterGrantExpiry,
  parseBranchWorkspacePath,
} from "../lib/auth/temporary-privilege-session";
import type { TemporaryGrant } from "../prisma/generated/prisma/client";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function grant(resource: string, action: string): TemporaryGrant {
  return { resource, action } as TemporaryGrant;
}

test("finance:read couvre finance + read uniquement", () => {
  const g = grant("finance", "read");
  assert.equal(grantMatchesPermission(g, "finance", "read"), true);
  assert.equal(grantMatchesPermission(g, "finance", "encaisser"), false);
  assert.equal(grantMatchesPermission(g, "fees", "read"), false);
});

test("finance:read ne couvre pas finance:encaisser", () => {
  assert.equal(
    grantsCoverPermissions([grant("finance", "read")], {
      finance: ["encaisser"],
    }),
    false,
  );
});

test("create / update / delete couvrent la lecture, sans se croiser", () => {
  assert.equal(grantMatchesPermission(grant("notes", "create"), "notes", "read"), true);
  assert.equal(grantMatchesPermission(grant("notes", "update"), "notes", "read"), true);
  assert.equal(grantMatchesPermission(grant("notes", "delete"), "notes", "read"), true);
  assert.equal(grantMatchesPermission(grant("notes", "create"), "notes", "update"), false);
  assert.equal(grantMatchesPermission(grant("notes", "update"), "notes", "delete"), false);
  assert.equal(grantMatchesPermission(grant("notes", "read"), "notes", "create"), false);
});

test("encaisser n'implique pas la lecture des rapports", () => {
  assert.equal(
    grantMatchesPermission(grant("finance", "encaisser"), "finance", "read"),
    false,
  );
});

test("lecture seule reste un octroi autonome", () => {
  assert.deepEqual(expandTemporaryGrantActions("read"), ["read"]);
  assert.deepEqual(expandTemporaryGrantActions("update"), ["update", "read"]);
  assert.deepEqual(expandTemporaryGrantActions("create"), ["create", "read"]);
  assert.deepEqual(expandTemporaryGrantActions("delete"), ["delete", "read"]);
  assert.deepEqual(expandTemporaryGrantActions("encaisser"), ["encaisser"]);
});

test("catalogue finance : tout le menu, un sous-menu ou une sélection multiple", () => {
  assert.deepEqual(resolveTemporaryGrantResources("finance", GRANT_GROUP_ALL), [
    "fees",
    "finance",
    "payroll",
    "transactions",
  ]);
  assert.deepEqual(resolveTemporaryGrantResources("finance", "fees"), ["fees"]);
  assert.deepEqual(resolveTemporaryGrantResources("cursus", "notes"), ["notes"]);
  assert.deepEqual(
    resolveTemporaryGrantResources("finance", ["fees", "finance"]),
    ["fees", "finance"],
  );
});

test("sélection multiple d'actions : lecture dédupliquée si écriture", () => {
  assert.deepEqual(normalizeSelectedGrantActions(["read"]), ["read"]);
  assert.deepEqual(normalizeSelectedGrantActions(["create", "read"]), ["create"]);
  assert.deepEqual(
    normalizeSelectedGrantActions(["create", "update", "read"]),
    ["create", "update"],
  );
});

test("paires octroi : encaisser seulement sur le paiement", () => {
  assert.deepEqual(
    buildTemporaryGrantPairs(["fees", "finance"], ["create", "encaisser"]),
    [
      { resource: "fees", action: "create" },
      { resource: "finance", action: "create" },
      { resource: "finance", action: "encaisser" },
    ],
  );
});

test("zone notes accessible avec notes:update (lecture accompagnante)", () => {
  assert.equal(
    grantsCoverBranchArea([grant("notes", "update")], "notes"),
    true,
  );
  assert.equal(
    grantsCoverBranchArea([grant("notes", "read")], "notes"),
    true,
  );
});

test("zone finance accessible avec finance:read ou finance:encaisser", () => {
  assert.equal(
    grantsCoverBranchArea([grant("finance", "read")], "finance"),
    true,
  );
  assert.equal(
    grantsCoverBranchArea([grant("finance", "encaisser")], "finance"),
    true,
  );
  assert.equal(
    grantsCoverBranchArea([grant("notes", "read")], "finance"),
    false,
  );
});

test("zone payroll accessible avec payroll:read", () => {
  assert.equal(
    grantsCoverBranchArea([grant("payroll", "read")], "payroll"),
    true,
  );
  assert.equal(
    grantsCoverBranchArea([grant("finance", "read")], "payroll"),
    false,
  );
});

test("fee_catalog exige fees:read, pas finance:read", () => {
  assert.equal(
    grantsCoverBranchArea([grant("fees", "read")], "fee_catalog"),
    true,
  );
  assert.equal(
    grantsCoverBranchArea([grant("finance", "read")], "fee_catalog"),
    false,
  );
});

test("octroi paie n'ouvre pas les transactions, et inversement", () => {
  assert.equal(
    grantsCoverBranchArea([grant("payroll", "read")], "payroll"),
    true,
  );
  assert.equal(
    grantsCoverBranchArea([grant("payroll", "read")], "transactions"),
    false,
  );
  assert.equal(
    grantsCoverBranchArea([grant("transactions", "read")], "transactions"),
    true,
  );
  assert.equal(
    grantsCoverBranchArea([grant("transactions", "read")], "payroll"),
    false,
  );
});

test("octroi personnel n'ouvre pas les parents, et inversement", () => {
  assert.equal(
    grantsCoverBranchArea([grant("personnel", "read")], "hr_directory"),
    true,
  );
  assert.equal(
    grantsCoverBranchArea([grant("personnel", "read")], "parents"),
    false,
  );
  assert.equal(
    grantsCoverBranchArea([grant("parent", "read")], "parents"),
    true,
  );
});

test("octroi élèves n'ouvre pas les enseignants", () => {
  assert.equal(
    grantsCoverBranchArea([grant("student", "read")], "students"),
    true,
  );
  assert.equal(
    grantsCoverBranchArea([grant("student", "read")], "pedagogy"),
    false,
  );
  assert.equal(
    grantsCoverBranchArea([grant("teacher", "read")], "pedagogy"),
    true,
  );
});

test("parseBranchWorkspacePath mappe paiement vers /admin/paiement", () => {
  const parsed = parseBranchWorkspacePath(
    "/admin/organizations/org1/branches/br1/paiement",
  );
  assert.equal(parsed?.logicalHref, "/admin/paiement");
  assert.equal(parsed?.dashboardHref, "/admin/organizations/org1/branches/br1");
  assert.equal(parsed?.isDashboard, false);
});

test("page paiement n'est plus autorisée si hideHrefs contient /admin/paiement", () => {
  const parsed = parseBranchWorkspacePath(
    "/admin/organizations/org1/branches/br1/paiement",
  );
  assert.ok(parsed);
  assert.equal(isGrantedWorkspacePage(parsed), true);
  assert.equal(
    pageStillAllowedAfterGrantExpiry(parsed, {
      hideHrefs: ["/admin/paiement"],
      settingsReads: {},
    }),
    false,
  );
  assert.equal(
    pageStillAllowedAfterGrantExpiry(parsed, {
      hideHrefs: ["/admin/notes"],
      settingsReads: {},
    }),
    true,
  );
});

test("sous-page octroyée (attendance/pointage) mappe vers le menu et n'est plus autorisée", () => {
  const parsed = parseBranchWorkspacePath(
    "/admin/organizations/org1/branches/br1/attendance/pointage",
  );
  assert.equal(parsed?.logicalHref, "/admin/attendance");
  assert.equal(parsed?.isDashboard, false);
  assert.ok(parsed);
  assert.equal(isGrantedWorkspacePage(parsed), true);
  assert.equal(
    pageStillAllowedAfterGrantExpiry(parsed, {
      hideHrefs: ["/admin/attendance"],
      settingsReads: {},
    }),
    false,
  );
});

test("paie-enseignants/credits mappe vers le href le plus long", () => {
  const parsed = parseBranchWorkspacePath(
    "/admin/organizations/org1/branches/br1/paie-enseignants/credits",
  );
  assert.equal(parsed?.logicalHref, "/admin/paie-enseignants/credits");
  assert.ok(parsed);
  assert.equal(
    pageStillAllowedAfterGrantExpiry(parsed, {
      hideHrefs: ["/admin/paie-enseignants/credits"],
      settingsReads: {},
    }),
    false,
  );
});

test("le dashboard branche reste autorisé après expiration", () => {
  const parsed = parseBranchWorkspacePath(
    "/admin/organizations/org1/branches/br1",
  );
  assert.equal(parsed?.isDashboard, true);
  assert.ok(parsed);
  assert.equal(isGrantedWorkspacePage(parsed), false);
  assert.equal(
    pageStillAllowedAfterGrantExpiry(parsed, {
      hideHrefs: Object.keys({
        "/admin/paiement": true,
      }),
      settingsReads: {},
    }),
    true,
  );
});

test("create / update / delete ne se croisent pas, mais autorisent l'écriture", () => {
  assert.equal(
    grantsAllowWrite([grant("teaching", "create")], "teaching"),
    true,
  );
  assert.equal(grantsAllowWrite([grant("teaching", "read")], "teaching"), false);
  assert.equal(
    grantMatchesPermission(grant("student", "create"), "student", "create"),
    true,
  );
  assert.equal(
    grantMatchesPermission(grant("student", "create"), "student", "update"),
    false,
  );
  assert.equal(
    grantMatchesPermission(grant("student", "update"), "student", "update"),
    true,
  );
  assert.equal(
    grantMatchesPermission(grant("student", "delete"), "student", "delete"),
    true,
  );
});

test("ressource d'octroi par zone", () => {
  assert.equal(grantResourceForArea("students"), "student");
  assert.equal(grantResourceForArea("courses"), "courses");
  assert.equal(grantResourceForArea("teaching"), "teaching");
  assert.equal(grantResourceForArea("classe"), "classe");
  assert.equal(grantResourceForArea("schedule"), "schedule");
  assert.equal(grantResourceForArea("ponderations"), "ponderations");
});

console.log("\nAll temporary grant tests passed.");
