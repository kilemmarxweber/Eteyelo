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

test("caissier : Dashboard, Finance, Aide — pas Classes / Enseignement / Présences / Candidatures / Cursus notes", () => {
  const session = sessionWithOrgRole(ORG_ROLE.CAISSIER);
  const titles = menuTitles(session);

  assertIncludes(titles, ["Dashboard", "Finance", "Aide"], "caissier");
  assertExcludes(
    titles,
    ["Inscription", "Presences", "Candidatures", "Classes", "Enseignement", "Utilisateurs", "Cursus"],
    "caissier",
  );
  assert.equal(hasMenuTitle(session, "Finance"), true);
});

test("élève : Dashboard, Notes, Horaire, Résultats/Fiches, Bibliothèque — pas Finance / admin", () => {
  const session = sessionWithOrgRole(ORG_ROLE.STUDENT);
  const titles = menuTitles(session);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["Dashboard", "Cursus", "Aide"], "élève");
  assertExcludes(
    titles,
    ["Finance", "Utilisateurs", "Classes", "Inscription", "Enseignement", "Candidatures"],
    "élève",
  );
  assertIncludes(
    cursus,
    ["Notes", "Horaire", "Résultats", "Fiches", "Bibliothèque"],
    "élève cursus",
  );
  assertExcludes(cursus, ["Attestations", "Brevets", "Relevés de notes", "Fiche Centrale"], "élève cursus");
});

test("parent : Dashboard, Notes/Horaire/Résultats/Fiches — pas Finance / admin / biblio", () => {
  const session = sessionWithOrgRole(ORG_ROLE.PARENT);
  const titles = menuTitles(session);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["Dashboard", "Cursus", "Aide"], "parent");
  assertExcludes(
    titles,
    ["Finance", "Utilisateurs", "Classes", "Inscription", "Enseignement"],
    "parent",
  );
  assertIncludes(cursus, ["Notes", "Horaire", "Résultats", "Fiches"], "parent cursus");
  assertExcludes(cursus, ["Bibliothèque"], "parent cursus");
});

test("enseignant : Enseignement restreint (Horaire), Notes, Résultats — pas Finance / Classes setup", () => {
  const session = sessionWithOrgRole(ORG_ROLE.TEACHER);
  const titles = menuTitles(session);
  const links = buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE");
  const enseignement = links.find((item) => item.title === "Enseignement");
  const enseignementSubs = (enseignement?.sub ?? []).map((item) => item.title);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["Dashboard", "Enseignement", "Cursus", "Presences", "Aide"], "enseignant");
  assertExcludes(titles, ["Finance", "Classes", "Inscription", "Candidatures"], "enseignant");
  assertIncludes(enseignementSubs, ["Horaire"], "enseignant enseignement");
  assertExcludes(
    enseignementSubs,
    ["Cours", "Ponderations", "Affectations", "Vacation"],
    "enseignant enseignement",
  );
  assertIncludes(cursus, ["Notes", "Résultats"], "enseignant cursus");
  assertExcludes(cursus, ["Horaire"], "enseignant cursus");
});

test("préfet / directeur : pédagogie + Finance (chef établissement unifié)", () => {
  for (const role of [ORG_ROLE.PREFET, ORG_ROLE.DIRECTEUR] as const) {
    const titles = menuTitles(sessionWithOrgRole(role));
    assertIncludes(
      titles,
      [
        "Dashboard",
        "Inscription",
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

test("directeur des études : pédagogie — pas Finance", () => {
  const session = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);
  const titles = menuTitles(session);

  assertIncludes(
    titles,
    ["Dashboard", "Inscription", "Utilisateurs", "Enseignement", "Classes", "Cursus", "Aide"],
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
        "Dashboard",
        "Inscription",
        "Presences",
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
