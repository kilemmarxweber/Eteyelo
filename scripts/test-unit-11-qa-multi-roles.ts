/**
 * Smoke tests — unit-11 QA multi-rôles (menus, dashboard, gates, unification).
 * Agrège les critères d’acceptation de la checklist unit-11.
 */
import assert from "node:assert/strict";

import {
  canAccessBranchArea,
  type BranchArea,
} from "../lib/auth/branch-area-access";
import {
  getDashboardDataBlocks,
  resolveDashboardVariant,
} from "../lib/auth/dashboard-variant";
import {
  canAccessOrganizationOwnerSections,
  canAccessOrganizationPartenaires,
  canArchiveOrganization,
  canCreateOrganization,
  canDeleteOrganization,
} from "../lib/auth/organization-access";
import { canAccessOrganizationAdminHome } from "../lib/auth/organization-admin-home";
import {
  canAccessBranchOrgSettings,
  canAccessFinanceArea,
  canDeleteOrganizationResource,
  canManageHrDirectory,
  canManageOrganization,
  isSchoolLeadershipRole,
} from "../lib/auth/session-roles";
import {
  isCursusSelfScopedRole,
  resolveCursusViewerRole,
} from "../lib/auth/cursus-scope";
import { orgRoleLabel, schoolHeadRoleLabel } from "../lib/org-role-labels";
import { APP_ROLE, ORG_ROLE } from "../lib/permissions";
import { OWNER_ONLY_MENU_ROLES, buildStaticSideLinks } from "../lib/sidebar-menu";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

const ORG_ID = "org_eteyelo_demo";
const BRANCH_ID = "cmruzkbw4000068tmt6xjehei";
const BRANCH_PATH = `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}`;

function sessionWithOrgRole(role: string, extra?: Record<string, unknown>) {
  return {
    organization: { role },
    branch: { typebranch: "PRIMAIRE" },
    ...extra,
  };
}

function menuTitles(role: string, extra?: Record<string, unknown>) {
  return buildStaticSideLinks(
    sessionWithOrgRole(role, extra),
    BRANCH_PATH,
    "PRIMAIRE",
  ).map((item) => item.title);
}

function cursusSubs(role: string, extra?: Record<string, unknown>) {
  const cursus = buildStaticSideLinks(
    sessionWithOrgRole(role, extra),
    BRANCH_PATH,
    "PRIMAIRE",
  ).find((item) => item.title === "Cursus");
  return (cursus?.sub ?? []).map((item) => item.title);
}

function assertAreas(
  role: string,
  allowed: BranchArea[],
  denied: BranchArea[],
) {
  const session = sessionWithOrgRole(role);
  for (const area of allowed) {
    assert.equal(canAccessBranchArea(area, session), true, `allow ${role}/${area}`);
  }
  for (const area of denied) {
    assert.equal(canAccessBranchArea(area, session), false, `deny ${role}/${area}`);
  }
}

// --- Comptes / unification ---

test("unification préfet ≡ directeur (helpers + finance)", () => {
  for (const role of [ORG_ROLE.DIRECTEUR, ORG_ROLE.PREFET]) {
    const session = sessionWithOrgRole(role);
    assert.equal(isSchoolLeadershipRole(session), true);
    assert.equal(canManageOrganization(session), true);
    assert.equal(canAccessFinanceArea(session), true);
    assert.equal(canManageHrDirectory(session), true);
    assert.equal(resolveDashboardVariant(session), "directeur");
    const blocks = getDashboardDataBlocks("directeur");
    assert.equal(blocks.revenue, true);
    assert.equal(blocks.pedagogyMetrics, true);
  }
});

test("compte directeur_etudes : pédagogie sans finance", () => {
  const session = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);
  assert.equal(canManageOrganization(session), true);
  assert.equal(canAccessFinanceArea(session), false);
  assert.equal(resolveDashboardVariant(session), "directeur_etudes");
  assert.equal(getDashboardDataBlocks("directeur_etudes").revenue, false);
  assert.equal(menuTitles(ORG_ROLE.DIRECTEUR_ETUDES).includes("Finance"), false);
});

test("libellé UI primaire → Directeur ; secondaire → Préfet", () => {
  assert.equal(schoolHeadRoleLabel("PRIMAIRE"), "Directeur");
  assert.equal(schoolHeadRoleLabel("SECONDAIRE"), "Préfet");
  assert.equal(
    orgRoleLabel(ORG_ROLE.PREFET, { typebranch: "PRIMAIRE" }),
    "Directeur",
  );
  assert.equal(
    orgRoleLabel(ORG_ROLE.DIRECTEUR, { typebranch: "SECONDAIRE" }),
    "Préfet",
  );
});

// --- Caissier ---

test("caissier : menu Dashboard + Finance + Utilisateurs (+ Aide)", () => {
  const titles = menuTitles(ORG_ROLE.CAISSIER);
  assert.ok(titles.includes("Dashboard"));
  assert.ok(titles.includes("Finance"));
  assert.ok(titles.includes("Utilisateurs"));
  assert.ok(titles.includes("Aide"));
  for (const forbidden of ["Classes", "Enseignement", "Cursus"]) {
    assert.ok(!titles.includes(forbidden), `caissier ne doit pas voir ${forbidden}`);
  }
});

test("caissier : dashboard caisse ; /paiement OK ; pédagogie refusée ; élèves lecture OK", () => {
  assert.equal(resolveDashboardVariant(sessionWithOrgRole(ORG_ROLE.CAISSIER)), "caissier");
  assert.equal(getDashboardDataBlocks("caissier").cashier, true);
  assert.equal(getDashboardDataBlocks("caissier").pedagogyMetrics, false);
  assertAreas(
    ORG_ROLE.CAISSIER,
    ["finance", "students"],
    ["notes", "schedule", "school_admin", "teaching", "pedagogy"],
  );
});

// --- Élève ---

test("élève : cursus notes/horaire/résultats/biblio ; pas Finance", () => {
  const titles = menuTitles(ORG_ROLE.STUDENT);
  const cursus = cursusSubs(ORG_ROLE.STUDENT);
  assert.ok(titles.includes("Cursus"));
  assert.ok(!titles.includes("Finance"));
  assert.ok(!titles.includes("Utilisateurs"));
  for (const title of ["Notes", "Horaire", "Résultats", "Fiches", "Bibliothèque"]) {
    assert.ok(cursus.includes(title), `élève cursus ${title}`);
  }
  assert.equal(resolveDashboardVariant(sessionWithOrgRole(ORG_ROLE.STUDENT)), "student");
  assert.equal(isCursusSelfScopedRole(resolveCursusViewerRole(sessionWithOrgRole(ORG_ROLE.STUDENT))!), true);
  assertAreas(ORG_ROLE.STUDENT, ["notes", "schedule", "results", "library"], ["finance"]);
});

// --- Parent ---

test("parent : cursus enfants ; self-scoped ; pas Finance", () => {
  const titles = menuTitles(ORG_ROLE.PARENT);
  assert.ok(titles.includes("Cursus"));
  assert.ok(!titles.includes("Finance"));
  assert.equal(resolveCursusViewerRole(sessionWithOrgRole(ORG_ROLE.PARENT)), "parent");
  assert.equal(isCursusSelfScopedRole("parent"), true);
  assertAreas(ORG_ROLE.PARENT, ["notes", "schedule", "results"], ["finance", "library"]);
});

// --- Enseignant ---

test("enseignant : notes OK ; pas Finance / Enseignement ; dashboard mes classes", () => {
  const titles = menuTitles(ORG_ROLE.TEACHER);
  assert.ok(titles.includes("Cursus"));
  assert.ok(!titles.includes("Enseignement"));
  assert.ok(!titles.includes("Utilisateurs"));
  assert.ok(!titles.includes("Finance"));
  assert.equal(resolveDashboardVariant(sessionWithOrgRole(ORG_ROLE.TEACHER)), "teacher");
  assert.equal(getDashboardDataBlocks("teacher").revenue, false);
  assertAreas(ORG_ROLE.TEACHER, ["notes", "schedule", "teaching"], ["finance", "school_admin"]);
});

test("enseignant titulaire : fiches ; non-titulaire : pas Fiche Centrale", () => {
  const titulaire = cursusSubs(ORG_ROLE.TEACHER, {
    teacherContext: { isTitulaire: true },
  });
  const nonTitulaire = cursusSubs(ORG_ROLE.TEACHER, {
    teacherContext: { isTitulaire: false },
  });
  assert.ok(titulaire.includes("Fiches") || titulaire.includes("Fiche Centrale"));
  assert.ok(!nonTitulaire.includes("Fiche Centrale"));
});

// --- Directeur des études ---

test("directeur_etudes : pédagogie OK ; /paiement refusé ; HR lecture seule", () => {
  const titles = menuTitles(ORG_ROLE.DIRECTEUR_ETUDES);
  for (const title of ["Classes", "Enseignement", "Cursus", "Utilisateurs"]) {
    assert.ok(titles.includes(title), `études doit voir ${title}`);
  }
  assert.ok(!titles.includes("Finance"));
  assertAreas(
    ORG_ROLE.DIRECTEUR_ETUDES,
    ["school_admin", "pedagogy", "notes", "hr_directory"],
    ["finance", "hr_write", "branch_org_settings"],
  );
});

// --- Chef établissement ---

test("directeur/préfet : pédagogie + finance ; pas owner org", () => {
  for (const role of [ORG_ROLE.DIRECTEUR, ORG_ROLE.PREFET]) {
    const titles = menuTitles(role);
    assert.ok(titles.includes("Finance"));
    assert.ok(titles.includes("Classes"));
    assertAreas(role, ["finance", "school_admin", "hr_write"], ["branch_org_settings"]);

    const session = sessionWithOrgRole(role);
    assert.equal(canDeleteOrganizationResource(session), false);
    assert.equal(canAccessBranchOrgSettings(session), false);
    assert.equal(canDeleteOrganization(APP_ROLE.USER, role), false);
    assert.equal(canArchiveOrganization(APP_ROLE.USER, role), false);
    assert.equal(canCreateOrganization(APP_ROLE.USER), false);
    assert.equal(
      canAccessOrganizationPartenaires(APP_ROLE.USER, role),
      false,
    );
    assert.equal(
      canAccessOrganizationOwnerSections(APP_ROLE.USER, role),
      false,
    );
    assert.ok(!OWNER_ONLY_MENU_ROLES.includes(role as never));
  }
});

// --- Gestionnaire ---

test("gestionnaire : pas de régression menu large + dashboard pilotage", () => {
  const titles = menuTitles(ORG_ROLE.GESTIONNAIRE);
  for (const title of ["Dashboard", "Finance", "Classes", "Enseignement", "Utilisateurs"]) {
    assert.ok(titles.includes(title), `gestionnaire ${title}`);
  }
  assert.equal(
    resolveDashboardVariant(sessionWithOrgRole(ORG_ROLE.GESTIONNAIRE)),
    "directeur",
  );
  assert.equal(canAccessOrganizationAdminHome(ORG_ROLE.GESTIONNAIRE), true);
});

console.log("\nAll unit-11 multi-role QA smoke tests passed.");
