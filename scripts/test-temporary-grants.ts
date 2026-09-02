/**
 * Octrois temporaires — matching strict ressource/action et entrée de zone.
 */
import assert from "node:assert/strict";

import {
  grantMatchesPermission,
  grantsCoverBranchArea,
  grantsCoverPermissions,
} from "../lib/auth/temporary-privilege";
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
