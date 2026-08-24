import assert from "node:assert/strict";
import {
  ANGOLA_SECONDARY_LEVELS,
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
  shouldUseAngolaPrimaryStudyDeclaration,
} from "../lib/angola-primary-structure";
import { mapAngolaPrimaryGrades } from "../lib/angola-primary-declaration-render";
import { branchDocumentName } from "../lib/branch-document-name";
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
  assert.equal(getAngolaSecondaryCycle("11ª"), "CICLO2");
  assert.equal(getAngolaSecondaryCycle("13ª"), "CICLO2");
  assert.equal(getAngolaHoraireType("12ª"), "COMPLET");
  assert.equal(getAngolaHoraireType("13ª"), "REDUIT");
  assert.ok(isAngolaFirstCycleLevel("9ª"));
  assert.ok(isAngolaSecondCycleLevel("10ª"));
  assert.ok(isAngolaReducedHoursLevel("13ª"));
  assert.ok(isAngolaSecondarySystem("SECONDAIRE", "ANGOLAIS"));
  assert.equal(isAngolaSecondarySystem("SECONDAIRE", "CONGOLAIS"), false);
});

test("7ª–9ª núcleo comum ; 10ª–13ª section + option", () => {
  assert.equal(requiresOptionForClass("SECONDAIRE", "7ª", "ANGOLAIS"), false);
  assert.equal(requiresSectionForClass("SECONDAIRE", "7ª", "ANGOLAIS"), false);
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
    "ECPL",
  );
  assert.equal(
    branchDocumentName({
      name: "ECPL",
      description: "Complexo Escolar Anexo ao Magistério-Cabinda",
    }),
    "Complexo Escolar Anexo ao Magistério-Cabinda",
  );
});

test("Declaração de estudo : 7ª–9ª seulement", () => {
  assert.equal(
    angolaStudyDeclarationClassPhrase("7ª"),
    "7ª Sétima Classe",
  );
  assert.equal(
    angolaStudyDeclarationClassPhrase("8a"),
    "8ª Oitava Classe",
  );
  assert.equal(
    angolaStudyDeclarationClassPhrase("9ª A"),
    "9ª Nona Classe",
  );
  assert.equal(
    shouldUseAngolaStudyDeclaration("ANGOLAIS", "7ª", "7ª A"),
    true,
  );
  assert.equal(
    shouldUseAngolaStudyDeclaration("ANGOLAIS", "10ª", "10ª A"),
    false,
  );
  assert.equal(
    shouldUseAngolaStudyDeclaration("CONGOLAIS", "7ª", "7è A"),
    false,
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
  assert.equal(
    shouldUseAngolaPrimaryStudyDeclaration("ANGOLAIS", "PRIMAIRE", "2ª", "2ª A"),
    true,
  );
  assert.equal(
    shouldUseAngolaPrimaryStudyDeclaration("ANGOLAIS", "SECONDAIRE", "7ª", "7ª A"),
    false,
  );
  const grades = mapAngolaPrimaryGrades([
    ["Língua Portuguesa", { score: 9, maxScore: 10 }],
    ["Matemática", { score: 9, maxScore: 10 }],
    ["Estudo do Meio", { score: 8, maxScore: 10 }],
  ]);
  assert.equal(grades[0]?.header, "L. Port");
  assert.equal(grades[0]?.score, 9);
  assert.equal(grades[1]?.header, "Mat.");
  assert.equal(grades[2]?.header, "E. Meio");
});

console.log("Angola secondary tests passed.");
