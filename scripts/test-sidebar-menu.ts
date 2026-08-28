import assert from "node:assert/strict";

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
    ["finance", "users", "classes", "registration", "teaching", "candidatures", "myPresence"],
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
    ["finance", "users", "classes", "registration", "teaching", "myPresence"],
    "parent",
  );
  assertIncludes(cursus, ["results"], "parent cursus");
  assertExcludes(
    cursus,
    ["grades", "schedule", "homework", "library", "sheets"],
    "parent cursus",
  );
});

test("enseignant : pas teaching / users ; cursus grades/results/library ; horaire via dashboard", () => {
  const session = sessionWithOrgRole(ORG_ROLE.TEACHER);
  const titles = menuTitles(session);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["dashboard", "cursus", "attendance", "myPresence", "help"], "enseignant");
  assertExcludes(
    titles,
    [
      "finance",
      "classes",
      "registration",
      "candidatures",
      "teaching",
      "users",
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

test("préfet / directeur : pédagogie complète — pas finance", () => {
  for (const role of [ORG_ROLE.PREFET, ORG_ROLE.DIRECTEUR] as const) {
    const titles = menuTitles(sessionWithOrgRole(role));
    assertIncludes(
      titles,
      [
        "dashboard",
        "myPresence",
        "registration",
        "users",
        "teaching",
        "classes",
        "cursus",
        "help",
      ],
      role,
    );
    assertExcludes(titles, ["finance"], role);
  }
});

test("directeur des études : pédagogie — pas finance", () => {
  const session = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);
  const titles = menuTitles(session);

  assertIncludes(
    titles,
    ["dashboard", "myPresence", "registration", "users", "teaching", "classes", "cursus", "help"],
    "directeur des études",
  );
  assertExcludes(titles, ["finance"], "directeur des études");
});

test("owner / gestionnaire gardent le large (pas de régression)", () => {
  for (const role of [ORG_ROLE.OWNER, ORG_ROLE.GESTIONNAIRE]) {
    const titles = menuTitles(sessionWithOrgRole(role));
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
      role,
    );
  }
});

test("enseignant titulaire voit centralSheet / sheets", () => {
  const session = sessionWithOrgRole(ORG_ROLE.TEACHER, {
    teacherContext: { isTitulaire: true },
  });
  const cursus = cursusSubTitles(session);
  assertIncludes(cursus, ["centralSheet", "sheets", "grades", "results"], "titulaire");
});

console.log("\nAll sidebar-menu smoke tests passed.");
