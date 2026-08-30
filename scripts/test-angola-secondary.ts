import assert from "node:assert/strict";
import {
  ANGOLA_ELECT_OPTION_CODE,
  ANGOLA_ELECT_OPTION_NAME,
  ANGOLA_FIRST_CYCLE_LEVELS,
  ANGOLA_SECOND_CYCLE_LEVELS,
  ANGOLA_SECONDARY_CYCLE_LABEL,
  ANGOLA_SECONDARY_LEVELS,
  ANGOLA_TECNICA_SECTION_CODE,
  ANGOLA_TECNICA_SECTION_NAME,
  angolaStudyDeclarationClassPhrase,
  getAngolaHoraireType,
  getAngolaSecondaryCycle,
  isAngolaFirstCycleLevel,
  isAngolaReducedHoursLevel,
  isAngolaSecondCycleLevel,
  isAngolaSecondarySystem,
  shouldUseAngolaStudyDeclaration,
} from "../lib/angola-secondary-structure";
import {
  getClassLevelLabel,
  getClassLevelsForBranch,
  requiresOptionForClass,
  requiresSectionForClass,
} from "../lib/class-structure";
import {
  angolaPrimaryLevelLabel,
  ANGOLA_PRIMARY_CYCLE_LABEL,
  isAngolaPrimaryFirstCycleLevel,
  shouldUseAngolaPrimaryStudyDeclaration,
} from "../lib/angola-primary-structure";
import { filterSchoolCyclesForEducationSystem } from "../lib/cycle";
import { matchAngolaPrimaryCourse } from "../lib/angola-primary-course-catalog";
import {
  formatAngolaPrimaryIssueLine,
  mapAngolaPrimaryGrades,
  resolveAngolaPrimaryEnrollmentNumber,
  resolveAngolaPrimaryIdentityNumber,
} from "../lib/angola-primary-declaration-render";
import { matchAngolaSecondaryCourse } from "../lib/angola-secondary-course-catalog";
import {
  angolaDeclarationTurma,
  buildAngolaStudyDeclarationRows,
  formatAngolaDeclarationIssueLine,
} from "../lib/angola-study-declaration-render";
import { branchDocumentName } from "../lib/branch-document-name";
import { resolveBulletinLayoutKind } from "../lib/bulletin-context";
import { getActivePeriodKeys } from "../lib/academic-structure";
import {
  angolaDirectorTitle,
  angolaDeclarationSchoolLabel,
  declarationBlankName,
  formatPersonFullName,
  memberHasOrgRole,
} from "../lib/person-full-name";

function test(name: string, run: () => void) {
  run();
  console.log(`✓ ${name}`);
}

test("RDC secondaire inchangé", () => {
  const levels = getClassLevelsForBranch("SECONDAIRE");
  assert.ok(levels.includes("7è"));
  assert.ok(levels.includes("1è"));
  assert.ok(!levels.includes("9è"));
  assert.ok(!levels.includes("13è"));
});

test("Angola : 2 ciclos + 13ª horaire réduit", () => {
  assert.equal(ANGOLA_SECONDARY_LEVELS.length, 7);
  assert.equal(
    getClassLevelsForBranch("SECONDAIRE", "ANGOLAIS").join(","),
    "7ª,8ª,9ª,10ª,11ª,12ª,13ª",
  );
  assert.equal(getAngolaSecondaryCycle("8ª"), "CICLO1");
  assert.equal(getAngolaSecondaryCycle("9ª"), "CICLO2");
  assert.equal(getAngolaSecondaryCycle("11ª"), "CICLO2");
  assert.equal(getAngolaSecondaryCycle("13ª"), "CICLO2");
  assert.equal(getAngolaHoraireType("12ª"), "COMPLET");
  assert.equal(getAngolaHoraireType("13ª"), "REDUIT");
  assert.ok(isAngolaFirstCycleLevel("8ª"));
  assert.equal(isAngolaFirstCycleLevel("9ª"), false);
  assert.ok(isAngolaSecondCycleLevel("9ª"));
  assert.ok(isAngolaSecondCycleLevel("10ª"));
  assert.ok(isAngolaReducedHoursLevel("13ª"));
  assert.ok(isAngolaSecondarySystem("SECONDAIRE", "ANGOLAIS"));
  assert.equal(isAngolaSecondarySystem("SECONDAIRE", "CONGOLAIS"), false);
});

test("7ª–8ª núcleo comum ; 9ª–13ª section + option", () => {
  assert.equal(requiresOptionForClass("SECONDAIRE", "7ª", "ANGOLAIS"), false);
  assert.equal(requiresSectionForClass("SECONDAIRE", "7ª", "ANGOLAIS"), false);
  assert.equal(requiresOptionForClass("SECONDAIRE", "8ª", "ANGOLAIS"), false);
  assert.equal(requiresOptionForClass("SECONDAIRE", "9ª", "ANGOLAIS"), true);
  assert.equal(requiresOptionForClass("SECONDAIRE", "12ª", "ANGOLAIS"), true);
  assert.equal(requiresOptionForClass("SECONDAIRE", "13ª", "ANGOLAIS"), true);
  assert.equal(
    getClassLevelLabel("SECONDAIRE", "7ª", "ANGOLAIS"),
    "7ª (Sétima Classe)",
  );
  assert.equal(
    getClassLevelLabel("SECONDAIRE", "13ª", "ANGOLAIS"),
    "13ª (Décima Terceira Classe)",
  );
  assert.equal(
    getClassLevelLabel("SECONDAIRE", "7a", "ANGOLAIS"),
    "7ª (Sétima Classe)",
  );
});

test("Declaração : directora, père et mère", () => {
  assert.equal(angolaDirectorTitle("F"), "Directora");
  assert.equal(angolaDirectorTitle("M"), "Director");
  assert.equal(angolaDirectorTitle(null), "Directora");
  assert.equal(
    formatPersonFullName({
      name: "JOAO",
      postnom: "KIMBEMBE",
      prenom: "MANUEL",
    }),
    "JOAO KIMBEMBE MANUEL",
  );
  assert.equal(declarationBlankName(""), "________");
  assert.equal(declarationBlankName("Maria Santos"), "Maria Santos");
  assert.equal(memberHasOrgRole("prefet", "prefet"), true);
  assert.equal(memberHasOrgRole("teacher,prefet", "prefet"), true);
  assert.equal(memberHasOrgRole("directeur", "prefet"), false);
  assert.equal(
    angolaDeclarationSchoolLabel("École Communautaire", "ECPL"),
    "École Communautaire",
  );
  assert.equal(
    branchDocumentName({
      name: "ECPL",
      description: "Complexo Escolar Anexo ao Magistério-Cabinda",
    }),
    "Complexo Escolar Anexo ao Magistério-Cabinda",
  );
});

test("Declaração de estudo : 7ª (Sétima Classe) jusqu'à 13ª", () => {
  assert.equal(
    angolaStudyDeclarationClassPhrase("7ª"),
    "7ª (Sétima Classe)",
  );
  assert.equal(
    angolaStudyDeclarationClassPhrase("8a"),
    "8ª (Oitava Classe)",
  );
  assert.equal(
    angolaStudyDeclarationClassPhrase("9ª A"),
    "9ª (Nona Classe)",
  );
  assert.equal(
    angolaStudyDeclarationClassPhrase("12ª"),
    "12ª (Décima Segunda Classe)",
  );
  assert.equal(
    angolaStudyDeclarationClassPhrase("13ª"),
    "13ª (Décima Terceira Classe)",
  );
  assert.equal(
    shouldUseAngolaStudyDeclaration("ANGOLAIS", "7ª", "7ª A"),
    true,
  );
  assert.equal(
    shouldUseAngolaStudyDeclaration("ANGOLAIS", "10ª", "10ª A"),
    true,
  );
  assert.equal(
    shouldUseAngolaStudyDeclaration("ANGOLAIS", "13ª", "13ª"),
    true,
  );
  assert.equal(
    shouldUseAngolaStudyDeclaration("CONGOLAIS", "7ª", "7è A"),
    false,
  );
});

test("Bulletin 7ª–8ª et 9ª–12ª : même cadre secondaire (tronc commun)", () => {
  assert.equal(resolveBulletinLayoutKind("SECONDAIRE", "ANGOLAIS"), "secondary");
  assert.equal(resolveBulletinLayoutKind("PRIMAIRE", "ANGOLAIS"), "term-period");
  assert.deepEqual(
    getActivePeriodKeys("1.ª Período", "SECONDAIRE", "ANGOLAIS"),
    ["p1"],
  );
  assert.deepEqual(
    getActivePeriodKeys("2.ª Período", "SECONDAIRE", "ANGOLAIS"),
    ["p1", "p2"],
  );
  assert.deepEqual(
    getActivePeriodKeys("3.ª Período", "SECONDAIRE", "ANGOLAIS"),
    ["p1", "p2", "p3"],
  );
});

test("Primaire angolais : 1ª (Primeira Classe) … 6ª (Sexta Classe)", () => {
  assert.equal(
    getClassLevelsForBranch("PRIMAIRE", "ANGOLAIS").join(","),
    "1ª,2ª,3ª,4ª,5ª,6ª",
  );
  assert.equal(
    getClassLevelLabel("PRIMAIRE", "1ª", "ANGOLAIS"),
    "1ª (Primeira Classe)",
  );
  assert.equal(
    getClassLevelLabel("PRIMAIRE", "2a", "ANGOLAIS"),
    "2ª (Segunda Classe)",
  );
  assert.equal(angolaPrimaryLevelLabel("6ª"), "6ª (Sexta Classe)");
  assert.ok(getClassLevelsForBranch("PRIMAIRE").includes("1è"));
  assert.equal(isAngolaPrimaryFirstCycleLevel("4ª"), true);
  assert.equal(isAngolaPrimaryFirstCycleLevel("4ª A"), true);
  assert.equal(isAngolaPrimaryFirstCycleLevel("5ª"), true);
  assert.equal(isAngolaPrimaryFirstCycleLevel("6ª"), true);
  assert.equal(
    shouldUseAngolaPrimaryStudyDeclaration("ANGOLAIS", "PRIMAIRE", "2ª", "2ª A"),
    true,
  );
  assert.equal(
    shouldUseAngolaPrimaryStudyDeclaration("ANGOLAIS", "PRIMAIRE", "4ª", "4ª A"),
    true,
  );
  assert.equal(
    shouldUseAngolaPrimaryStudyDeclaration("ANGOLAIS", "PRIMAIRE", "5ª", "5ª A"),
    true,
  );
  assert.equal(
    shouldUseAngolaPrimaryStudyDeclaration("ANGOLAIS", "PRIMAIRE", "6ª", "6ª A"),
    true,
  );
  assert.equal(
    shouldUseAngolaPrimaryStudyDeclaration("ANGOLAIS", "SECONDAIRE", "7ª", "7ª A"),
    false,
  );
  assert.equal(matchAngolaPrimaryCourse("Língua Portuguesa")?.declarationLabel, "L. Port");
  assert.equal(matchAngolaPrimaryCourse("Mat.")?.declarationLabel, "Mat.");
  assert.equal(matchAngolaPrimaryCourse("Estudo do Meio")?.declarationLabel, "E. Meio");
  assert.equal(matchAngolaPrimaryCourse("E.M.P")?.declarationLabel, "E.M.P");
  assert.equal(matchAngolaPrimaryCourse("Educação Musical")?.declarationLabel, "E. Mus");
  assert.equal(matchAngolaPrimaryCourse("Educação Física")?.declarationLabel, "E. Fis");
  const grades = mapAngolaPrimaryGrades([
    ["Língua Portuguesa", { score: 8, maxScore: 10 }],
    ["Matemática", { score: 8, maxScore: 10 }],
    ["Estudo do Meio", { score: 8, maxScore: 10 }],
    ["E.M.P", { score: 8, maxScore: 10 }],
    ["Educação Musical", { score: 7, maxScore: 10 }],
    ["Educação Física", { score: 7, maxScore: 10 }],
  ]);
  assert.equal(grades.map((row) => row.header).join("|"), "L. Port|Mat.|E. Meio|E.M.P|E. Mus|E. Fis");
  assert.equal(grades[0]?.score, 8);
  assert.equal(grades[4]?.score, 7);
  assert.equal(
    resolveAngolaPrimaryIdentityNumber({ biNumber: "0230557106CA059" }),
    "0230557106CA059",
  );
  assert.equal(
    resolveAngolaPrimaryIdentityNumber({ studentCode: "0230557106CA059" }),
    "0230557106CA059",
  );
  assert.equal(resolveAngolaPrimaryIdentityNumber({}), "________");
  assert.equal(resolveAngolaPrimaryEnrollmentNumber({ enrollmentNumber: "1" }), "01");
  assert.equal(resolveAngolaPrimaryEnrollmentNumber({}), "____");
  assert.match(
    formatAngolaPrimaryIssueLine("Cabinda", new Date(2026, 7, 6)),
    /^Cabinda, ao 06 de Agosto de 2026$/,
  );
});

test("Catalogue PORTUGUESA + Declaração (tableau officiel)", () => {
  assert.equal(matchAngolaSecondaryCourse("Portugais")?.declarationLabel, "L. PORTUGUESA");
  assert.equal(matchAngolaSecondaryCourse("E.M.C")?.declarationLabel, "E.M.C");
  assert.equal(matchAngolaSecondaryCourse("Educação Física")?.declarationLabel, "ED. FÍSICA");
  assert.equal(angolaDeclarationTurma(null, "7ª"), "Única");
  assert.equal(angolaDeclarationTurma("A", "7ª A"), "A");
  assert.match(
    formatAngolaDeclarationIssueLine(
      "Complexo Escolar Anexo ao Magistério em Cabinda",
      new Date(2026, 7, 13),
    ),
    /^COMPLEXO ESCOLAR ANEXO AO MAGISTÉRIO EM CABINDA, AO 13 DE AGOSTO DE 2026$/,
  );

  const rows = buildAngolaStudyDeclarationRows({
    "Língua Portuguesa": { score: 10, maxScore: 20 },
    Matemática: { score: 14, maxScore: 20 },
    Biologia: { score: 10, maxScore: 20 },
    Geografia: { score: 10, maxScore: 20 },
    História: { score: 12, maxScore: 20 },
    Química: { score: 10, maxScore: 20 },
    Física: { score: 10, maxScore: 20 },
    "E.M.C": { score: 11, maxScore: 20 },
    Inglês: { score: 10, maxScore: 20 },
    "E.V.P": { score: 10, maxScore: 20 },
    "Ed. Laboral": { score: 10, maxScore: 20 },
    "Ed. Física": { score: 11, maxScore: 20 },
  });
  assert.equal(rows[0]?.disciplina, "L. PORTUGUESA");
  assert.equal(rows[0]?.score, 10);
  assert.equal(rows[1]?.score, 14);
  const frances = rows.find((row) => row.disciplina === "FRANCÊS");
  const religiao = rows.find((row) => row.disciplina === "RELIGIÃO");
  assert.ok(frances);
  assert.ok(Number.isNaN(frances.score));
  assert.ok(religiao);
  assert.ok(Number.isNaN(religiao.score));
});

test("Création branche Angola : pas de maternelle, noms PT", () => {
  assert.equal(
    ANGOLA_PRIMARY_CYCLE_LABEL,
    "Ensino primário / 1.º ciclo do ensino básico",
  );
  assert.equal(ANGOLA_SECONDARY_CYCLE_LABEL, "Ensino secundário");
  assert.deepEqual(
    filterSchoolCyclesForEducationSystem(
      ["MATERNELLE", "PRIMAIRE", "SECONDAIRE"],
      "ANGOLAIS",
    ),
    ["PRIMAIRE", "SECONDAIRE"],
  );
  assert.deepEqual(
    filterSchoolCyclesForEducationSystem(
      ["MATERNELLE", "PRIMAIRE"],
      "CONGOLAIS",
    ),
    ["MATERNELLE", "PRIMAIRE"],
  );
  assert.equal(ANGOLA_FIRST_CYCLE_LEVELS.join(","), "7ª,8ª");
  assert.equal(ANGOLA_SECOND_CYCLE_LEVELS.join(","), "9ª,10ª,11ª,12ª");
  assert.equal(ANGOLA_TECNICA_SECTION_CODE, "TECNICA");
  assert.equal(ANGOLA_TECNICA_SECTION_NAME, "Técnica");
  assert.equal(ANGOLA_ELECT_OPTION_CODE, "ELECT");
  assert.equal(ANGOLA_ELECT_OPTION_NAME, "Electricidade");
});

console.log("Angola secondary tests passed.");
