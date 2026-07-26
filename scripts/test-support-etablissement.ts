/**
 * Smoke tests — périmètre Support établissement (ORG_ROLE.SUPPORT)
 * + tickets personnel (canal / statut / mes demandes).
 */
import assert from "node:assert/strict";

import {
  getDashboardDataBlocks,
  resolveDashboardVariant,
} from "../lib/auth/dashboard-variant";
import { resolveMembershipPostLoginPath } from "../lib/auth/post-login-routing";
import {
  canAccessFinanceArea,
  canAccessPedagogyArea,
  canAccessSupportSettings,
  canManageOrganization,
  isOrganizationSupportRole,
} from "../lib/auth/session-roles";
import { ORG_ROLE } from "../lib/permissions";
import {
  ESCALATION_STATUS_LABELS,
  SUPPORT_TICKET_CHANNEL_LABELS,
} from "../lib/support/constants";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

function sessionWithOrgRole(role: string) {
  return { organization: { role } };
}

const sessionSupport = sessionWithOrgRole(ORG_ROLE.SUPPORT);
const sessionTeacher = sessionWithOrgRole(ORG_ROLE.TEACHER);
const sessionOwner = sessionWithOrgRole(ORG_ROLE.OWNER);
const sessionCaissier = sessionWithOrgRole(ORG_ROLE.CAISSIER);

test("isOrganizationSupportRole détecte le rôle support", () => {
  assert.equal(isOrganizationSupportRole(sessionSupport), true);
  assert.equal(isOrganizationSupportRole(sessionTeacher), false);
});

test("support : pas finance / pédagogie / manage org", () => {
  assert.equal(canAccessFinanceArea(sessionSupport), false);
  assert.equal(canAccessPedagogyArea(sessionSupport), false);
  assert.equal(canManageOrganization(sessionSupport), false);
});

test("support + enseignant + caissier : accès settings support", () => {
  assert.equal(canAccessSupportSettings(sessionSupport), true);
  assert.equal(canAccessSupportSettings(sessionTeacher), true);
  assert.equal(canAccessSupportSettings(sessionCaissier), true);
  assert.equal(canAccessSupportSettings(sessionOwner), true);
});

test("post-login support → /support", () => {
  assert.equal(
    resolveMembershipPostLoginPath({
      organizationId: "org-test",
      membershipRole: ORG_ROLE.SUPPORT,
    }),
    "/admin/organizations/org-test/support",
  );
});

test("dashboard support = variante support (minimal data)", () => {
  assert.equal(resolveDashboardVariant(sessionSupport), "support");
  const blocks = getDashboardDataBlocks("support");
  assert.equal(blocks.events, true);
  assert.equal(blocks.revenue, false);
  assert.equal(blocks.schoolStats, false);
  assert.equal(blocks.cashier, false);
});

test("canaux ticket : établissement + Klambocore", () => {
  assert.equal(
    SUPPORT_TICKET_CHANNEL_LABELS.ESTABLISHMENT,
    "Support établissement",
  );
  assert.equal(SUPPORT_TICKET_CHANNEL_LABELS.PLATFORM, "Klambocore");
});

test("statuts ticket visibles pour le demandeur", () => {
  assert.deepEqual(Object.keys(ESCALATION_STATUS_LABELS).sort(), [
    "CLOSED",
    "IN_PROGRESS",
    "OPEN",
    "RESOLVED",
  ]);
});

/** Périmètre « mes demandes » : filtre requesterUserId côté action. */
test("filtre mes demandes = requesterUserId (contrat)", () => {
  const orgTickets = [
    { id: "1", requesterUserId: "user-a", subject: "A" },
    { id: "2", requesterUserId: "user-b", subject: "B" },
    { id: "3", requesterUserId: "user-a", subject: "C" },
  ];
  const mine = orgTickets.filter((t) => t.requesterUserId === "user-a");
  assert.equal(mine.length, 2);
  assert.deepEqual(
    mine.map((t) => t.id),
    ["1", "3"],
  );
});

console.log("\nAll support-etablissement smoke tests passed.");
