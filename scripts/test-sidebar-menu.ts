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
    (item) => item.title === "Cursus",
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

test("caissier : Tableau de bord, Inscription, Finance, Utilisateurs/Élève, Aide — pas Classes / Enseignement / Cursus", () => {
  const session = sessionWithOrgRole(ORG_ROLE.CAISSIER);
  const titles = menuTitles(session);
  const users = buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE").find(
    (item) => item.title === "Utilisateurs",
  );
  const usersSubs = (users?.sub ?? []).map((item) => item.title);

  assertIncludes(
    titles,
    ["Tableau de bord", "Inscription", "Finance", "Utilisateurs", "Aide"],
    "caissier",
  );
  assertExcludes(
    titles,
    ["Présences", "Candidatures", "Classes", "Enseignement", "Cursus"],
    "caissier",
  );
  assertIncludes(usersSubs, ["Élève"], "caissier utilisateurs");
  assertExcludes(usersSubs, ["Personnel", "Enseignant", "Parent"], "caissier utilisateurs");
  assert.equal(hasMenuTitle(session, "Finance"), true);
});

test("élève : Tableau de bord, Résultats, Bibliothèque — pas Notes/Horaire/Fiches / Finance", () => {
  const session = sessionWithOrgRole(ORG_ROLE.STUDENT);
  const titles = menuTitles(session);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["Tableau de bord", "Cursus", "Aide"], "élève");
  assertExcludes(
    titles,
    ["Finance", "Utilisateurs", "Classes", "Inscription", "Enseignement", "Candidatures"],
    "élève",
  );
  assertIncludes(cursus, ["Résultats", "Bibliothèque"], "élève cursus");
  assertExcludes(
    cursus,
    [
      "Notes",
      "Horaire",
      "Fiches",
      "Attestations",
      "Brevets",
      "Relevés de notes",
      "Fiche Centrale",
    ],
    "élève cursus",
  );
});

test("parent : Tableau de bord + Résultats — pas Notes/Horaire/Devoirs/Bibliothèque / Finance / admin", () => {
  const session = sessionWithOrgRole(ORG_ROLE.PARENT);
  const titles = menuTitles(session);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["Tableau de bord", "Cursus", "Aide"], "parent");
  assertExcludes(
    titles,
    ["Finance", "Utilisateurs", "Classes", "Inscription", "Enseignement"],
    "parent",
  );
  assertIncludes(cursus, ["Résultats"], "parent cursus");
  assertExcludes(
    cursus,
    ["Notes", "Horaire", "Devoirs", "Bibliothèque", "Fiches"],
    "parent cursus",
  );
});

test("enseignant : pas Enseignement / Utilisateurs ; Cursus Notes/Résultats/Bibliothèque ; Horaire via Tableau de bord", () => {
  const session = sessionWithOrgRole(ORG_ROLE.TEACHER);
  const titles = menuTitles(session);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["Tableau de bord", "Cursus", "Présences", "Aide"], "enseignant");
  assertExcludes(
    titles,
    [
      "Finance",
      "Classes",
      "Inscription",
      "Candidatures",
      "Enseignement",
      "Utilisateurs",
    ],
    "enseignant",
  );
  assertIncludes(
    cursus,
    ["Notes", "Résultats", "Bibliothèque"],
    "enseignant cursus",
  );
  assertExcludes(cursus, ["Horaire"], "enseignant cursus");
});

test("préfet / directeur : pédagogie complète — pas Finance", () => {
  for (const role of [ORG_ROLE.PREFET, ORG_ROLE.DIRECTEUR] as const) {
    const titles = menuTitles(sessionWithOrgRole(role));
    assertIncludes(
      titles,
      [
        "Tableau de bord",
        "Inscription",
        "Utilisateurs",
        "Enseignement",
        "Classes",
        "Cursus",
        "Aide",
      ],
      role,
    );
    assertExcludes(titles, ["Finance"], role);
  }
});

test("directeur des études : pédagogie — pas Finance", () => {
  const session = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);
  const titles = menuTitles(session);

  assertIncludes(
    titles,
    ["Tableau de bord", "Inscription", "Utilisateurs", "Enseignement", "Classes", "Cursus", "Aide"],
    "directeur des études",
  );
  assertExcludes(titles, ["Finance"], "directeur des études");
});

test("owner / gestionnaire gardent le large (pas de régression)", () => {
  for (const role of [ORG_ROLE.OWNER, ORG_ROLE.GESTIONNAIRE]) {
    const titles = menuTitles(sessionWithOrgRole(role));
    assertIncludes(
      titles,
      [
        "Tableau de bord",
        "Inscription",
        "Présences",
        "Candidatures",
        "Utilisateurs",
        "Enseignement",
        "Classes",
        "Finance",
        "Cursus",
        "Aide",
      ],
      role,
    );
  }
});

test("enseignant titulaire voit Fiche Centrale / Fiches", () => {
  const session = sessionWithOrgRole(ORG_ROLE.TEACHER, {
    teacherContext: { isTitulaire: true },
  });
  const cursus = cursusSubTitles(session);
  assertIncludes(cursus, ["Fiche Centrale", "Fiches", "Notes", "Résultats"], "titulaire");
});

console.log("\nAll sidebar-menu smoke tests passed.");
