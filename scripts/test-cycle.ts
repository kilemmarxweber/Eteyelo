import assert from "node:assert/strict";

import {
  getAcademicStructure,
  buildPeriodFieldMap,
} from "../lib/academic-structure";
import { resolveBulletinLayoutKind } from "../lib/bulletin-context";
import {
  getBranchCapabilities,
  isPrimaryBranch,
  usesBulletinForBranch,
  usesSectionOptionForBranch,
} from "../lib/branch-capabilities";
import {
  buildClassCode,
  buildClassName,
  compareClassesByLevel,
  getClassLevelLabel,
  getClassLevelsForBranch,
  requiresOptionForClass,
  requiresSectionForClass,
  allowsOptionForBranch,
} from "../lib/class-structure";
import {
  getBranchCycles,
  isMaternelleCycle,
  isPrimaryLikeCycle,
  principalTypebranchFromSchoolCycles,
  resolveActivatedCycles,
  resolveCycle,
  resolveRequestedCycle,
  buildDashboardCycleStats,
  schoolCyclesForBranchForm,
  sameCycleSet,
} from "../lib/cycle";
import { toBranchFormValues } from "../lib/branch-form-values";
import { matchesClassForLevel } from "../lib/class-enrollment/match-class-for-level";
import { shouldHideSidebarHref } from "../lib/branch-route-guard";
import {
  examCodesExistForCycle,
  getExamCodeLevels,
  getStudentExamCodesActionState,
  isExamCodesClass,
  isFinalistListingClass,
} from "../lib/exam-export-meta";
import {
  findCtebOption,
  findCtebSection,
  getCtebLockDefaults,
} from "../lib/class-catalog";
import {
  maternelleLevelOptionCode,
  maternelleLevelOptionName,
  maternelleOptionDisplayName,
  resolveMaternelleClassLevel,
} from "../lib/maternelle-academic-structure";

function test(name: string, run: () => void) {
  run();
  console.log(`✓ ${name}`);
}

test("resolveCycle : données legacy → typebranch", () => {
  assert.equal(resolveCycle(undefined, { typebranch: "PRIMAIRE" }), "PRIMAIRE");
  assert.equal(resolveCycle({ cycle: null }, { typebranch: "SECONDAIRE" }), "SECONDAIRE");
  assert.equal(resolveCycle({}, { typebranch: "PRIMAIRE" }), "PRIMAIRE");
});

test("resolveCycle : classe.cycle prioritaire", () => {
  assert.equal(
    resolveCycle({ cycle: "MATERNELLE" }, { typebranch: "SECONDAIRE" }),
    "MATERNELLE",
  );
});

test("getBranchCycles vide = [typebranch]", () => {
  assert.deepEqual(getBranchCycles({ typebranch: "PRIMAIRE" }), ["PRIMAIRE"]);
  assert.deepEqual(
    getBranchCycles({
      typebranch: "SECONDAIRE",
      cycles: [
        { cycle: "MATERNELLE", isActive: true, sortOrder: 0 },
        { cycle: "PRIMAIRE", isActive: true, sortOrder: 1 },
        { cycle: "SECONDAIRE", isActive: true, sortOrder: 2 },
      ],
    }),
    ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
  );
  assert.deepEqual(
    getBranchCycles({
      typebranch: "SECONDAIRE",
      cycles: ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
    }),
    ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
  );
});

test("Maternelle : calendrier identique au primaire", () => {
  assert.equal(getAcademicStructure("MATERNELLE").periods.length, 9);
  assert.equal(
    getAcademicStructure("MATERNELLE").periods.length,
    getAcademicStructure("PRIMAIRE").periods.length,
  );
  assert.equal(getAcademicStructure("SECONDAIRE").periods.length, 6);
});

test("Maternelle : layout bulletin primary", () => {
  assert.equal(resolveBulletinLayoutKind("MATERNELLE"), "primary");
  assert.equal(resolveBulletinLayoutKind("PRIMAIRE"), "primary");
  assert.equal(resolveBulletinLayoutKind("SECONDAIRE"), "secondary");
});

test("Maternelle : 4 niveaux dont Crèche", () => {
  assert.deepEqual(getClassLevelsForBranch("MATERNELLE"), [
    "Crèche",
    "1è",
    "2è",
    "3è",
  ]);
  assert.equal(getClassLevelLabel("MATERNELLE", "Crèche"), "Crèche");
  assert.equal(getClassLevelLabel("MATERNELLE", "1è"), "1è-MATE");
  assert.equal(getClassLevelLabel("PRIMAIRE", "1è"), "1è-PR");
});

test("Noms de classe 1è-MATE et 1è-PR distincts", () => {
  assert.equal(buildClassName({ typebranch: "MATERNELLE", level: "1è" }), "1è-MATE");
  assert.equal(buildClassName({ typebranch: "PRIMAIRE", level: "1è" }), "1è-PR");
  assert.notEqual(
    buildClassName({ typebranch: "MATERNELLE", level: "1è" }),
    buildClassName({ typebranch: "PRIMAIRE", level: "1è" }),
  );
});

test("Maternelle 1è-MATE ne collisionne pas avec Humanités MAT", () => {
  assert.equal(
    buildClassCode({
      typebranch: "SECONDAIRE",
      level: "1è",
      optionAbbrev: "MAT",
    }),
    "1è-MAT",
  );
  assert.equal(
    buildClassCode({ typebranch: "MATERNELLE", level: "1è" }),
    "1è-MATE",
  );
  assert.notEqual(
    buildClassCode({ typebranch: "MATERNELLE", level: "1è" }),
    buildClassCode({
      typebranch: "SECONDAIRE",
      level: "1è",
      optionAbbrev: "MAT",
    }),
  );
});

test("Maternelle : codes option de pondération distincts du primaire", () => {
  assert.equal(maternelleLevelOptionCode("Crèche"), "MAT-CRECHE");
  assert.equal(maternelleLevelOptionCode("1è"), "MAT-1");
  assert.equal(maternelleLevelOptionName("Crèche"), "Crèche");
  assert.equal(maternelleLevelOptionName("1è"), "1è-MATE");
  assert.equal(maternelleOptionDisplayName("Crèche"), "Crèche");
  assert.equal(maternelleOptionDisplayName("1è"), "1è année");
  assert.equal(resolveMaternelleClassLevel({ level: "1è" }), "1è");
  assert.equal(
    resolveMaternelleClassLevel({ nameClasse: "1è-MATE A" }),
    "1è",
  );
  assert.equal(
    resolveMaternelleClassLevel({ nameClasse: "1è-PR A" }),
    null,
  );
});

test("Maternelle : pas d'option / section, pas TENAFEP", () => {
  assert.equal(requiresOptionForClass("MATERNELLE", "1è"), false);
  assert.equal(requiresSectionForClass("MATERNELLE", "1è"), false);
  assert.equal(isPrimaryBranch("MATERNELLE"), false);
  assert.equal(isPrimaryLikeCycle("MATERNELLE"), true);
  assert.equal(isMaternelleCycle("MATERNELLE"), true);
  assert.equal(usesBulletinForBranch("MATERNELLE"), true);
  assert.equal(usesSectionOptionForBranch("MATERNELLE"), false);
  assert.equal(getBranchCapabilities("MATERNELLE").label, "Maternelle");
});

test("buildPeriodFieldMap : maternelle = primaire, distinct du secondaire", () => {
  const primary = buildPeriodFieldMap("PRIMAIRE");
  const secondary = buildPeriodFieldMap("SECONDAIRE");
  const maternelle = buildPeriodFieldMap("MATERNELLE");
  assert.equal(Object.keys(maternelle).length, Object.keys(primary).length);
  assert.notEqual(Object.keys(primary).length, Object.keys(secondary).length);
  assert.ok(primary["1ere Periode"] || primary["1ère Periode"] || Object.keys(primary).length > 0);
});

test("Sidebar : union des cycles (section visible si secondaire présent)", () => {
  assert.equal(shouldHideSidebarHref("/section", "PRIMAIRE"), true);
  assert.equal(shouldHideSidebarHref("/section", ["PRIMAIRE", "SECONDAIRE"]), false);
  assert.equal(shouldHideSidebarHref("/finalistes", "MATERNELLE"), true);
  assert.equal(shouldHideSidebarHref("/finalistes", ["MATERNELLE", "PRIMAIRE"]), false);
  assert.equal(shouldHideSidebarHref("/fiches", ["MATERNELLE", "SECONDAIRE"]), false);
});

test("principalTypebranchFromSchoolCycles : maternelle seule → PRIMAIRE", () => {
  assert.equal(principalTypebranchFromSchoolCycles(["MATERNELLE"]), "PRIMAIRE");
  assert.equal(principalTypebranchFromSchoolCycles(["PRIMAIRE"]), "PRIMAIRE");
  assert.equal(
    principalTypebranchFromSchoolCycles(["MATERNELLE", "SECONDAIRE"]),
    "SECONDAIRE",
  );
});

test("resolveActivatedCycles : maternelle seule n'active pas PRIMAIRE", () => {
  assert.deepEqual(
    resolveActivatedCycles({
      typebranch: "PRIMAIRE",
      schoolCycles: ["MATERNELLE"],
    }),
    ["MATERNELLE"],
  );
  assert.deepEqual(
    resolveActivatedCycles({
      typebranch: "SECONDAIRE",
      schoolCycles: ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
    }),
    ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
  );
  assert.deepEqual(
    resolveActivatedCycles({ typebranch: "ATELIER", schoolCycles: ["PRIMAIRE"] }),
    ["ATELIER"],
  );
  assert.deepEqual(
    resolveActivatedCycles({
      typebranch: "SECONDAIRE",
      schoolCycles: ["SECONDAIRE"],
      extraCycles: ["ATELIER"],
    }),
    ["SECONDAIRE", "ATELIER"],
  );
});

test("schoolCyclesForBranchForm : union BranchCycle + classes, y compris inactif", () => {
  assert.deepEqual(
    schoolCyclesForBranchForm({
      typebranch: "SECONDAIRE",
      branchCycles: [{ cycle: "SECONDAIRE", isActive: true }],
      classCycles: ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
    }),
    ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
  );
  assert.deepEqual(
    schoolCyclesForBranchForm({
      typebranch: "SECONDAIRE",
      branchCycles: [{ cycle: "MATERNELLE", isActive: false }],
      classCycles: [],
    }),
    ["MATERNELLE"],
  );
  assert.deepEqual(
    schoolCyclesForBranchForm({
      typebranch: "ATELIER",
      branchCycles: [{ cycle: "ATELIER", isActive: true }],
      classCycles: ["PRIMAIRE"],
    }),
    [],
  );
  assert.equal(
    sameCycleSet(["MATERNELLE", "SECONDAIRE"], ["SECONDAIRE", "MATERNELLE"]),
    true,
  );
  assert.equal(sameCycleSet(["PRIMAIRE"], ["PRIMAIRE", "SECONDAIRE"]), false);
});

test("allowsOptionForBranch : maternelle n'expose pas d'option", () => {
  assert.equal(allowsOptionForBranch("MATERNELLE"), false);
  assert.equal(allowsOptionForBranch("PRIMAIRE"), false);
  assert.equal(allowsOptionForBranch("SECONDAIRE"), true);
  assert.equal(allowsOptionForBranch(""), false);
});

test("1è : matching isolé par cycle", () => {
  const primaire = {
    level: "1è",
    optionId: null,
    nameClasse: "1è-PR",
    cycle: "PRIMAIRE",
  };
  const secondaire = {
    level: "1è",
    optionId: "opt-bio",
    nameClasse: "1è BIO",
    cycle: "SECONDAIRE",
    option: { id: "opt-bio", nameOption: "Biologie" },
  };
  const maternelle = {
    level: "1è",
    optionId: null,
    nameClasse: "1è-MATE",
    cycle: "MATERNELLE",
  };

  assert.equal(
    matchesClassForLevel(primaire, {
      typebranch: "SECONDAIRE",
      level: "1è",
      cycle: "PRIMAIRE",
    }),
    true,
  );
  assert.equal(
    matchesClassForLevel(secondaire, {
      typebranch: "SECONDAIRE",
      level: "1è",
      cycle: "PRIMAIRE",
    }),
    false,
  );
  assert.equal(
    matchesClassForLevel(maternelle, {
      typebranch: "SECONDAIRE",
      level: "1è",
      cycle: "MATERNELLE",
    }),
    true,
  );
  assert.equal(
    matchesClassForLevel(primaire, {
      typebranch: "SECONDAIRE",
      level: "1è",
      cycle: "MATERNELLE",
    }),
    false,
  );
  assert.equal(
    matchesClassForLevel(
      { ...primaire, optionId: "pond-1" },
      {
        typebranch: "SECONDAIRE",
        level: "1è",
        cycle: "PRIMAIRE",
        optionId: "pond-other",
      },
    ),
    true,
  );
});

test("7è CTEB : classes visibles sans optionId (multi-cycle)", () => {
  const cteb = {
    level: "7è",
    optionId: "tronc",
    nameClasse: "7è Tronc commun",
    cycle: "SECONDAIRE",
    option: { id: "tronc", nameOption: "Tronc commun" },
  };
  const primaire = {
    level: "1è",
    optionId: "pri-1",
    nameClasse: "1è-PR",
    cycle: "PRIMAIRE",
  };
  assert.equal(
    matchesClassForLevel(cteb, {
      typebranch: "SECONDAIRE",
      level: "7è",
      cycle: "SECONDAIRE",
    }),
    true,
  );
  assert.equal(
    matchesClassForLevel(primaire, {
      typebranch: "SECONDAIRE",
      level: "1è",
      cycle: "PRIMAIRE",
    }),
    true,
  );
  assert.equal(
    matchesClassForLevel(cteb, {
      typebranch: "SECONDAIRE",
      level: "7è",
      cycle: "PRIMAIRE",
    }),
    false,
  );
});

test("resolveRequestedCycle : multi-cycle exige un cycle", () => {
  assert.equal(
    resolveRequestedCycle({
      typebranch: "SECONDAIRE",
      branchCycles: ["MATERNELLE"],
    }),
    "MATERNELLE",
  );
  assert.throws(
    () =>
      resolveRequestedCycle({
        typebranch: "SECONDAIRE",
        branchCycles: ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
      }),
    /type de branche/,
  );
  assert.equal(
    resolveRequestedCycle({
      cycle: "PRIMAIRE",
      typebranch: "SECONDAIRE",
      branchCycles: ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
    }),
    "PRIMAIRE",
  );
});

test("buildDashboardCycleStats : totaux par cycle, enseignant partagé compté deux fois", () => {
  const stats = buildDashboardCycleStats({
    cycles: ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
    typebranch: "SECONDAIRE",
    classes: [
      { cycle: "MATERNELLE" },
      { cycle: "MATERNELLE" },
      { cycle: "PRIMAIRE" },
      { cycle: null },
    ],
    enrollments: [
      { studentId: "s1", classe: { cycle: "MATERNELLE" } },
      { studentId: "s2", classe: { cycle: "PRIMAIRE" } },
      { studentId: "s2", classe: { cycle: "PRIMAIRE" } },
      { studentId: "s3", classe: { cycle: null } },
    ],
    teachings: [
      { teacherId: "t1", classe: { cycle: "MATERNELLE" } },
      { teacherId: "t1", classe: { cycle: "PRIMAIRE" } },
      { teacherId: "t2", classe: { cycle: "SECONDAIRE" } },
    ],
    payments: [
      { amount: 400, cycle: "MATERNELLE" },
      { amount: 600, cycle: "PRIMAIRE" },
      { amount: 400, cycle: "PRIMAIRE" },
    ],
  });

  assert.deepEqual(
    stats.map((row) => [
      row.cycle,
      row.classes,
      row.students,
      row.teachers,
      row.revenue,
    ]),
    [
      ["MATERNELLE", 2, 1, 1, 400],
      ["PRIMAIRE", 1, 1, 1, 1000],
      ["SECONDAIRE", 1, 1, 1, 0],
    ],
  );
});

test("buildDashboardCycleStats : branche mono-cycle → vide", () => {
  assert.deepEqual(
    buildDashboardCycleStats({
      cycles: ["PRIMAIRE"],
      typebranch: "PRIMAIRE",
      classes: [{ cycle: "PRIMAIRE" }],
      enrollments: [],
      teachings: [],
    }),
    [],
  );
});

test("E13/E80 : secondaire terminal uniquement, pas 6è ni 8è", () => {
  assert.deepEqual(getExamCodeLevels("MATERNELLE"), []);
  assert.equal(examCodesExistForCycle("MATERNELLE"), false);
  assert.equal(
    isExamCodesClass({
      cycle: "MATERNELLE",
      typebranch: "PRIMAIRE",
      level: "3è",
      className: "3è-MATE",
    }),
    false,
  );
  assert.equal(
    getStudentExamCodesActionState(
      {
        classLevel: "1è",
        classCycle: "MATERNELLE",
        className: "1è-MATE",
        classCode: "1è-MATE",
      },
      { typebranch: "PRIMAIRE" },
    ),
    "hidden",
  );

  assert.deepEqual(getExamCodeLevels("PRIMAIRE"), []);
  assert.equal(examCodesExistForCycle("PRIMAIRE"), false);
  assert.equal(
    isExamCodesClass({ cycle: "PRIMAIRE", typebranch: "PRIMAIRE", level: "5è" }),
    false,
  );
  assert.equal(
    isExamCodesClass({ cycle: "PRIMAIRE", typebranch: "PRIMAIRE", level: "6è" }),
    false,
  );
  assert.equal(
    getStudentExamCodesActionState(
      { classLevel: "2è", classCycle: "PRIMAIRE", className: "2è-PR" },
      { typebranch: "PRIMAIRE" },
    ),
    "hidden",
  );
  assert.equal(
    getStudentExamCodesActionState(
      { classLevel: "6è", classCycle: "PRIMAIRE", className: "6è-PR" },
      { typebranch: "PRIMAIRE" },
    ),
    "hidden",
  );

  assert.deepEqual(getExamCodeLevels("SECONDAIRE"), ["4è"]);
  assert.equal(
    isExamCodesClass({
      cycle: "SECONDAIRE",
      typebranch: "SECONDAIRE",
      level: "8è",
    }),
    false,
  );
  assert.equal(
    getStudentExamCodesActionState(
      { classLevel: "8è", classCycle: "SECONDAIRE", className: "8è TC" },
      { typebranch: "SECONDAIRE" },
    ),
    "hidden",
  );
  assert.equal(
    isExamCodesClass({
      cycle: "SECONDAIRE",
      typebranch: "SECONDAIRE",
      level: "4è",
    }),
    true,
  );
  assert.equal(
    isExamCodesClass({
      cycle: "SECONDAIRE",
      typebranch: "SECONDAIRE",
      level: "12ª",
      educationSystem: "ANGOLAIS",
    }),
    true,
  );
  assert.equal(examCodesExistForCycle("ATELIER"), false);
  assert.equal(examCodesExistForCycle("CENTRE_FORMATION"), false);

  assert.equal(
    isFinalistListingClass({
      cycle: "PRIMAIRE",
      typebranch: "PRIMAIRE",
      level: "6è",
      className: "6è-PR",
    }),
    true,
  );
  assert.equal(
    isFinalistListingClass({
      cycle: "SECONDAIRE",
      typebranch: "SECONDAIRE",
      level: "8è",
      className: "8è TC",
    }),
    true,
  );
  assert.equal(
    isFinalistListingClass({
      cycle: "SECONDAIRE",
      typebranch: "SECONDAIRE",
      level: "7è",
      className: "7è TC",
    }),
    false,
  );
  assert.equal(
    isFinalistListingClass({
      cycle: "SECONDAIRE",
      typebranch: "SECONDAIRE",
      level: "4è",
      className: "4è MATH",
    }),
    true,
  );
});

test("7è / 8è : Tronc commun CTEB par défaut", () => {
  const defaults = getCtebLockDefaults();
  assert.equal(defaults.optionName, "Tronc commun");
  assert.equal(defaults.sectionName, "Éducation de Base (CTEB)");
  const sections = [
    { id: "s1", codeSection: "SCIE", nameSection: "Scientifique", cycle: "SECONDAIRE" },
    { id: "s2", codeSection: "CTEB", nameSection: "Éducation de Base (CTEB)", cycle: "SECONDAIRE" },
  ];
  const options = [
    { id: "o1", codeOption: "BIO", nameOption: "Biologie", sectionId: "s1", cycle: "SECONDAIRE" },
    { id: "o2", codeOption: "TRONC-COM", nameOption: "Tronc commun", sectionId: "s2", cycle: "SECONDAIRE" },
  ];
  assert.equal(findCtebSection(sections, "SECONDAIRE")?.id, "s2");
  assert.equal(findCtebOption(options, "SECONDAIRE")?.id, "o2");
});

test("classes triées du plus petit niveau au plus grand", () => {
  const rows = [
    { nameClasse: "6è-PR", level: "6è", cycle: "PRIMAIRE" },
    { nameClasse: "1è-PR A", level: "1è", cycle: "PRIMAIRE" },
    { nameClasse: "2è-PR", level: "2è", cycle: "PRIMAIRE" },
    { nameClasse: "1è-MATE", level: "1è", cycle: "MATERNELLE" },
  ];
  const ordered = [...rows].sort(compareClassesByLevel).map((row) => row.nameClasse);
  assert.deepEqual(ordered, ["1è-MATE", "1è-PR A", "2è-PR", "6è-PR"]);

  const secondary = [
    { nameClasse: "1è BIO", level: "1è", cycle: "SECONDAIRE" },
    { nameClasse: "8è TC", level: "8è", cycle: "SECONDAIRE" },
    { nameClasse: "7è TC", level: "7è", cycle: "SECONDAIRE" },
  ];
  assert.deepEqual(
    [...secondary].sort(compareClassesByLevel).map((row) => row.level),
    ["7è", "8è", "1è"],
  );
});

test("toBranchFormValues : champs obligatoires et cycles issus des classes", () => {
  const values = toBranchFormValues({
    name: "École test",
    typebranch: "SECONDAIRE",
    educationSystem: "CONGOLAIS",
    latitude: null,
    longitude: null,
    attendanceRadius: 5,
    cycles: [{ cycle: "SECONDAIRE", isActive: true }],
    classes: [{ cycle: "MATERNELLE" }, { cycle: "PRIMAIRE" }],
  });
  assert.equal(values.latitude, -4.4419);
  assert.equal(values.attendanceRadius, 10);
  assert.deepEqual(values.schoolCycles, [
    "MATERNELLE",
    "PRIMAIRE",
    "SECONDAIRE",
  ]);
  assert.equal(values.pays, "RDC");
});

console.log("Cycle tests passed.");
