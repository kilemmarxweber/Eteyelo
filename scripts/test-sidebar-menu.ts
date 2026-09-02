import assert from "node:assert/strict";

import { SIDEBAR_HREF_BRANCH_AREA } from "../lib/auth/branch-area-permissions";
import { ORG_ROLE } from "../lib/permissions";
import { buildStaticSideLinks } from "../lib/sidebar-menu";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

const ORG_ID = "org-test";
const BRANCH_ID = "branch-primaire";
const BRANCH_PATH = `/admin/organizations/${ORG_ID}/branches/${BRANCH_ID}`;

function sessionWithOrgRole(role: string, extra?: Record<string, unknown>) {
  return {
    organization: { role },
    branch: { typebranch: "PRIMAIRE" },
    ...extra,
  };
}

function menuTitles(session: ReturnType<typeof sessionWithOrgRole>) {
  return buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE").map(
    (item) => item.title,
  );
}

function hasMenuTitle(
  session: ReturnType<typeof sessionWithOrgRole>,
  title: string,
) {
  return menuTitles(session).includes(title);
}

function cursusSubTitles(session: ReturnType<typeof sessionWithOrgRole>) {
  const cursus = buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE").find(
    (item) => item.title === "cursus",
  );
  return (cursus?.sub ?? []).map((item) => item.title);
}

function assertIncludes(actual: string[], expected: string[], label: string) {
  for (const title of expected) {
    assert.ok(actual.includes(title), `${label} doit voir « ${title} »`);
  }
}

function assertExcludes(actual: string[], forbidden: string[], label: string) {
  for (const title of forbidden) {
    assert.ok(!actual.includes(title), `${label} ne doit pas voir « ${title} »`);
  }
}

test("caissier : dashboard, registration, finance, users/student, help — pas classes / teaching / cursus", () => {
  const session = sessionWithOrgRole(ORG_ROLE.CAISSIER);
  const titles = menuTitles(session);
  const users = buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE").find(
    (item) => item.title === "users",
  );
  const usersSubs = (users?.sub ?? []).map((item) => item.title);

  assertIncludes(
    titles,
    ["dashboard", "myPresence", "registration", "finance", "users", "help"],
    "caissier",
  );
  assertExcludes(
    titles,
    ["attendance", "candidatures", "classes", "teaching", "cursus"],
    "caissier",
  );
  assertIncludes(usersSubs, ["student"], "caissier utilisateurs");
  assertExcludes(usersSubs, ["staff", "teacher", "parent"], "caissier utilisateurs");
  assert.equal(hasMenuTitle(session, "finance"), true);

  const finance = buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE").find(
    (item) => item.title === "finance",
  );
  const financeSubs = (finance?.sub ?? []).map((item) => item.title);
  assertIncludes(financeSubs, ["payment"], "caissier finance");
  assertExcludes(financeSubs, ["fees"], "caissier finance");
});

test("élève : dashboard, results, library — pas grades/schedule/sheets / finance", () => {
  const session = sessionWithOrgRole(ORG_ROLE.STUDENT);
  const titles = menuTitles(session);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["dashboard", "cursus", "help"], "élève");
  assertExcludes(
    titles,
    ["finance", "users", "classes", "registration", "teaching", "candidatures", "myPresence", "messaging"],
    "élève",
  );
  assertIncludes(cursus, ["results", "library"], "élève cursus");
  assertExcludes(
    cursus,
    [
      "grades",
      "schedule",
      "sheets",
      "attestations",
      "certificates",
      "transcripts",
      "centralSheet",
    ],
    "élève cursus",
  );
});

test("parent : dashboard + results — pas grades/schedule/homework/library / finance / admin", () => {
  const session = sessionWithOrgRole(ORG_ROLE.PARENT);
  const titles = menuTitles(session);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["dashboard", "cursus", "help"], "parent");
  assertExcludes(
    titles,
    ["finance", "users", "classes", "registration", "teaching", "myPresence", "messaging"],
    "parent",
  );
  assertIncludes(cursus, ["results"], "parent cursus");
  assertExcludes(
    cursus,
    ["grades", "schedule", "homework", "library", "sheets"],
    "parent cursus",
  );
});

test("enseignant : pas teaching / users ; cursus grades/results/library ; dossier via dashboard", () => {
  const session = sessionWithOrgRole(ORG_ROLE.TEACHER);
  const titles = menuTitles(session);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["dashboard", "cursus", "myPresence", "help"], "enseignant");
  assertExcludes(
    titles,
    [
      "finance",
      "classes",
      "registration",
      "candidatures",
      "teaching",
      "users",
      "messaging",
    ],
    "enseignant",
  );
  assertIncludes(
    cursus,
    ["grades", "results", "library"],
    "enseignant cursus",
  );
  assertExcludes(cursus, ["schedule"], "enseignant cursus");
});

test("préfet / directeur DAC : pédagogie — pas finance / inscription / candidatures", () => {
  const leadershipHide = [
    "/admin/registration",
    "/admin/candidatures",
    "/admin/frais",
    "/admin/paiement",
    "/admin/paie-enseignants",
    "/admin/transactions",
  ];

  for (const role of [ORG_ROLE.PREFET, ORG_ROLE.DIRECTEUR] as const) {
    const titles = buildStaticSideLinks(
      sessionWithOrgRole(role),
      BRANCH_PATH,
      "PRIMAIRE",
      undefined,
      { hideHrefs: leadershipHide, dacReady: true, dacStrictMenu: true },
    ).map((item) => item.title);

    assertIncludes(
      titles,
      ["dashboard", "myPresence", "users", "teaching", "classes", "cursus", "help"],
      role,
    );
    assertExcludes(titles, ["finance", "registration", "candidatures"], role);
  }
});

test("directeur des études DAC : pédagogie — pas finance / inscription / candidatures", () => {
  const leadershipHide = [
    "/admin/registration",
    "/admin/candidatures",
    "/admin/frais",
    "/admin/paiement",
    "/admin/paie-enseignants",
    "/admin/transactions",
  ];
  const session = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);
  const titles = buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE", undefined, {
    hideHrefs: leadershipHide,
    dacReady: true,
    dacStrictMenu: true,
  }).map((item) => item.title);

  assertIncludes(
    titles,
    ["dashboard", "myPresence", "users", "teaching", "classes", "cursus", "help"],
    "directeur des études",
  );
  assertExcludes(
    titles,
    ["finance", "registration", "candidatures"],
    "directeur des études",
  );
});

test("owner : large accès — sans Ma présence / pointage perso", () => {
  const titles = menuTitles(sessionWithOrgRole(ORG_ROLE.OWNER));
  assertIncludes(
    titles,
    [
      "dashboard",
      "registration",
      "attendance",
      "candidatures",
      "users",
      "teaching",
      "classes",
      "finance",
      "cursus",
      "help",
    ],
    "owner",
  );
  assertExcludes(titles, ["myPresence", "messaging"], "owner");
});

test("propriétaire de branche : tous les menus malgré le rôle organisation user", () => {
  const session = sessionWithOrgRole("user", {
    user: { role: "user" },
    branchMemberRole: "ADMIN",
  });
  const titles = menuTitles(session);
  const finance = buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE").find(
    (item) => item.title === "finance",
  );
  const financeSubs = (finance?.sub ?? []).map((item) => item.title);

  assertIncludes(
    titles,
    [
      "dashboard",
      "registration",
      "attendance",
      "candidatures",
      "users",
      "teaching",
      "classes",
      "finance",
      "cursus",
      "settings",
      "help",
    ],
    "propriétaire de branche",
  );
  assertIncludes(financeSubs, ["teacherPayroll", "transactions"], "paie propriétaire de branche");
});

test("directeur de branche : pas le bypass propriétaire (menus limités au rôle org)", () => {
  const session = sessionWithOrgRole("user", {
    user: { role: "user" },
    branchMemberRole: "DIRECTOR",
  });
  const titles = menuTitles(session);
  assertExcludes(
    titles,
    ["finance", "attendance", "candidatures", "teaching", "classes"],
    "directeur de branche",
  );
});

test("dacStrict : paramètres toujours visible (profil / apparence / mot de passe)", () => {
  const session = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);
  const titles = buildStaticSideLinks(
    session,
    BRANCH_PATH,
    "PRIMAIRE",
    "PRIMAIRE",
    {
      hideHrefs: Object.keys(SIDEBAR_HREF_BRANCH_AREA),
      dacReady: true,
      dacStrictMenu: true,
    },
  ).map((item) => item.title);
  assert.ok(
    titles.includes("settings"),
    "settings reste visible en mode DAC strict",
  );
});

test("gestionnaire garde le large (y compris Ma présence)", () => {
  const titles = menuTitles(sessionWithOrgRole(ORG_ROLE.GESTIONNAIRE));
  assertIncludes(
    titles,
    [
      "dashboard",
      "myPresence",
      "registration",
      "attendance",
      "candidatures",
      "users",
      "teaching",
      "classes",
      "finance",
      "cursus",
      "help",
    ],
    "gestionnaire",
  );
  assertExcludes(titles, ["messaging"], "gestionnaire");
});

test("enseignant titulaire voit centralSheet / sheets", () => {
  const session = sessionWithOrgRole(ORG_ROLE.TEACHER, {
    teacherContext: { isTitulaire: true },
  });
  const cursus = cursusSubTitles(session);
  assertIncludes(cursus, ["centralSheet", "sheets", "grades", "results"], "titulaire");
});

console.log("\nAll sidebar-menu smoke tests passed.");
