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
import {
  GRANT_GROUP_ALL,
  resolveTemporaryGrantResources,
} from "../lib/auth/temporary-grant-catalog";
import {
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

test("catalogue finance : tout le menu ou un sous-menu", () => {
  assert.deepEqual(resolveTemporaryGrantResources("finance", GRANT_GROUP_ALL), [
    "fees",
    "finance",
    "payroll",
    "transactions",
  ]);
  assert.deepEqual(resolveTemporaryGrantResources("finance", "fees"), ["fees"]);
  assert.deepEqual(resolveTemporaryGrantResources("cursus", "notes"), ["notes"]);
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

console.log("\nAll temporary grant tests passed.");
