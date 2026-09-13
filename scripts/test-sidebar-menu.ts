import assert from "node:assert/strict";

import { SIDEBAR_HREF_BRANCH_AREA } from "../lib/auth/branch-area-permissions";
import { canAccessBranchAreaFromPermissions } from "../lib/auth/resolve-branch-area-permission";
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
  assertExcludes(financeSubs, ["fees", "transactions", "teacherPayroll"], "caissier finance");
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

test("enseignant : pas teaching / users / finance par défaut ; cursus grades/results/library", () => {
  const session = sessionWithOrgRole(ORG_ROLE.TEACHER);
  const titles = menuTitles(session);
  const cursus = cursusSubTitles(session);

  assertIncludes(titles, ["dashboard", "cursus", "myPresence", "help"], "enseignant");
  assertExcludes(
    titles,
    [
      "classes",
      "registration",
      "candidatures",
      "teaching",
      "users",
      "messaging",
      "finance",
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

test("préfet / directeur DAC : pédagogie — pas caisse / paie / inscription / candidatures", () => {
  const leadershipHide = [
    "/admin/registration",
    "/admin/candidatures",
    "/admin/frais",
    "/admin/paiement",
    "/admin/paie-enseignants",
    "/admin/paie-enseignants/credits",
    "/admin/transactions",
  ];

  for (const role of [ORG_ROLE.PREFET, ORG_ROLE.DIRECTEUR] as const) {
    const links = buildStaticSideLinks(
      sessionWithOrgRole(role),
      BRANCH_PATH,
      "PRIMAIRE",
      undefined,
      { hideHrefs: leadershipHide, dacReady: true, dacStrictMenu: true },
    );
    const titles = links.map((item) => item.title);
    const financeSubs = (
      links.find((item) => item.title === "finance")?.sub ?? []
    ).map((item) => item.title);

    assertIncludes(
      titles,
      ["dashboard", "myPresence", "users", "teaching", "classes", "cursus", "help"],
      role,
    );
    assertExcludes(titles, ["registration", "candidatures", "finance"], role);
    assertExcludes(financeSubs, ["fees", "payment", "transactions", "teacherPayroll"], role);
  }
});

test("directeur des études DAC : pédagogie — pas caisse / paie / inscription / candidatures", () => {
  const leadershipHide = [
    "/admin/registration",
    "/admin/candidatures",
    "/admin/frais",
    "/admin/paiement",
    "/admin/paie-enseignants",
    "/admin/paie-enseignants/credits",
    "/admin/transactions",
  ];
  const session = sessionWithOrgRole(ORG_ROLE.DIRECTEUR_ETUDES);
  const links = buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE", undefined, {
    hideHrefs: leadershipHide,
    dacReady: true,
    dacStrictMenu: true,
  });
  const titles = links.map((item) => item.title);
  const financeSubs = (
    links.find((item) => item.title === "finance")?.sub ?? []
  ).map((item) => item.title);

  assertIncludes(
    titles,
    ["dashboard", "myPresence", "users", "teaching", "classes", "cursus", "help"],
    "directeur des études",
  );
  assertExcludes(
    titles,
    ["registration", "candidatures", "finance"],
    "directeur des études",
  );
  assertExcludes(
    financeSubs,
    ["fees", "payment", "transactions", "teacherPayroll"],
    "études sans paie par défaut",
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
  assertExcludes(
    financeSubs,
    ["teacherPayroll", "transactions", "salaryCredits"],
    "paie réservée au propriétaire org / octroi",
  );
});

test("propriétaire org voit paie et transactions", () => {
  const session = sessionWithOrgRole(ORG_ROLE.OWNER);
  const finance = buildStaticSideLinks(session, BRANCH_PATH, "PRIMAIRE").find(
    (item) => item.title === "finance",
  );
  const financeSubs = (finance?.sub ?? []).map((item) => item.title);
  assertIncludes(financeSubs, ["teacherPayroll", "transactions"], "owner org");
});

test("paie / transactions visibles si hideHrefs ne les masque pas (DAC ou octroi)", () => {
  const session = sessionWithOrgRole(ORG_ROLE.GESTIONNAIRE);
  const finance = buildStaticSideLinks(
    session,
    BRANCH_PATH,
    "PRIMAIRE",
    undefined,
    { hideHrefs: ["/admin/frais"], dacReady: true, dacStrictMenu: true },
  ).find((item) => item.title === "finance");
  const financeSubs = (finance?.sub ?? []).map((item) => item.title);
  assertIncludes(
    financeSubs,
    ["teacherPayroll", "transactions", "payment"],
    "gestionnaire avec accès paie/transactions",
  );
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

test("DAC : fiche centrale seulement si titulaire de classe avec un cours", () => {
  const prev = process.env.PERMISSIONS_FROM_DAC;
  process.env.PERMISSIONS_FROM_DAC = "true";
  try {
    const teacher = sessionWithOrgRole(ORG_ROLE.TEACHER);
    assert.equal(
      canAccessBranchAreaFromPermissions("fiche_centrale", teacher),
      false,
      "enseignant non-titulaire : pas fiche centrale",
    );
    assert.equal(
      canAccessBranchAreaFromPermissions("fiches", teacher),
      false,
      "enseignant non-titulaire : pas fiches",
    );

    const teacherHide = Object.entries(SIDEBAR_HREF_BRANCH_AREA)
      .filter(
        ([, area]) => !canAccessBranchAreaFromPermissions(area, teacher),
      )
      .map(([href]) => href);
    const teacherCursus = (
      buildStaticSideLinks(teacher, BRANCH_PATH, "PRIMAIRE", undefined, {
        hideHrefs: teacherHide,
        dacReady: true,
        dacStrictMenu: true,
      }).find((item) => item.title === "cursus")?.sub ?? []
    ).map((item) => item.title);
    assertExcludes(
      teacherCursus,
      ["centralSheet", "sheets"],
      "DAC enseignant sans titulaire",
    );

    const titulaire = sessionWithOrgRole(ORG_ROLE.TEACHER, {
      teacherContext: { isTitulaire: true },
    });
    assert.equal(
      canAccessBranchAreaFromPermissions("fiche_centrale", titulaire),
      true,
      "titulaire : fiche centrale",
    );
    assert.equal(
      canAccessBranchAreaFromPermissions("fiches", titulaire),
      true,
      "titulaire : fiches",
    );

    const titulaireHide = Object.entries(SIDEBAR_HREF_BRANCH_AREA)
      .filter(
        ([, area]) => !canAccessBranchAreaFromPermissions(area, titulaire),
      )
      .map(([href]) => href);
    const titulaireCursus = (
      buildStaticSideLinks(titulaire, BRANCH_PATH, "PRIMAIRE", undefined, {
        hideHrefs: titulaireHide,
        dacReady: true,
        dacStrictMenu: true,
      }).find((item) => item.title === "cursus")?.sub ?? []
    ).map((item) => item.title);
    assertIncludes(
      titulaireCursus,
      ["centralSheet", "sheets"],
      "DAC titulaire",
    );

    const directeur = sessionWithOrgRole(ORG_ROLE.DIRECTEUR);
    assert.equal(
      canAccessBranchAreaFromPermissions("fiche_centrale", directeur),
      true,
      "direction : fiche centrale",
    );
  } finally {
    if (prev == null) delete process.env.PERMISSIONS_FROM_DAC;
    else process.env.PERMISSIONS_FROM_DAC = prev;
  }
});

test("DAC enseignant : pas paie / finance par défaut ; pas utilisateurs / enseignement / caisse", () => {
  const prev = process.env.PERMISSIONS_FROM_DAC;
  process.env.PERMISSIONS_FROM_DAC = "true";
  try {
    const session = sessionWithOrgRole(ORG_ROLE.TEACHER);
    const hideHrefs = Object.entries(SIDEBAR_HREF_BRANCH_AREA)
      .filter(
        ([, area]) => !canAccessBranchAreaFromPermissions(area, session),
      )
      .map(([href]) => href);
    const links = buildStaticSideLinks(
      session,
      BRANCH_PATH,
      "PRIMAIRE",
      undefined,
      { hideHrefs, dacReady: true, dacStrictMenu: true },
    );
    const titles = links.map((item) => item.title);
    const financeSubs = (
      links.find((item) => item.title === "finance")?.sub ?? []
    ).map((item) => item.title);

    assertIncludes(
      titles,
      ["dashboard", "cursus", "myPresence", "help"],
      "enseignant DAC",
    );
    assertExcludes(
      titles,
      ["users", "teaching", "classes", "registration", "finance"],
      "enseignant DAC",
    );
    assertExcludes(
      financeSubs,
      ["teacherPayroll", "fees", "payment", "transactions"],
      "enseignant DAC sans paie par défaut",
    );

    assert.equal(
      canAccessBranchAreaFromPermissions("roles_privileges", session),
      false,
      "enseignant sans ac:read",
    );

    const grantedRoles = sessionWithOrgRole(ORG_ROLE.TEACHER, {
      organization: {
        role: ORG_ROLE.TEACHER,
        rolePermissions: {
          [ORG_ROLE.TEACHER]: {
            ac: ["read"],
            notes: ["create", "read", "update"],
          },
        },
      },
    });
    assert.equal(
      canAccessBranchAreaFromPermissions("roles_privileges", grantedRoles),
      true,
      "enseignant avec matrice ac:read",
    );

    const granted = sessionWithOrgRole(ORG_ROLE.TEACHER, {
      organization: {
        role: ORG_ROLE.TEACHER,
        rolePermissions: {
          [ORG_ROLE.TEACHER]: {
            student: ["read"],
            teaching: ["read"],
            finance: ["read"],
            payroll: ["read"],
            notes: ["create", "read", "update"],
          },
        },
      },
    });
    const grantedHide = Object.entries(SIDEBAR_HREF_BRANCH_AREA)
      .filter(
        ([, area]) => !canAccessBranchAreaFromPermissions(area, granted),
      )
      .map(([href]) => href);
    const grantedTitles = buildStaticSideLinks(
      granted,
      BRANCH_PATH,
      "PRIMAIRE",
      undefined,
      { hideHrefs: grantedHide, dacReady: true, dacStrictMenu: true },
    ).map((item) => item.title);
    assertIncludes(
      grantedTitles,
      ["users", "teaching", "finance"],
      "enseignant avec matrice",
    );
  } finally {
    if (prev == null) delete process.env.PERMISSIONS_FROM_DAC;
    else process.env.PERMISSIONS_FROM_DAC = prev;
  }
});

console.log("\nAll sidebar-menu smoke tests passed.");
