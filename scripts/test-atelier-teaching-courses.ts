import assert from "node:assert/strict";
import {
  atelierConfiguredEmptyMessage,
  resolveAtelierConfiguredParentIds,
} from "../lib/atelier-teaching-courses";
import { configuredCoursIdsForClass } from "../lib/course-ponderation-shared";

function test(name: string, assertion: () => void) {
  assertion();
  console.log(`✓ ${name}`);
}

const link = (
  atelierCoursId: string,
  secondaryCoursId: string,
  secondaryBranchId = "school-a",
) => ({ atelierCoursId, secondaryCoursId, secondaryBranchId });

test("groupe sans classe source → liste vide NO_SOURCE", () => {
  const result = resolveAtelierConfiguredParentIds({
    sourceClasseId: null,
    secondaryConfiguredCoursIds: ["sec-math", "sec-phys"],
    atelierLinks: [link("atl-1", "sec-math")],
  });
  assert.deepEqual(result.coursIds, []);
  assert.equal(result.emptyReason, "NO_SOURCE");
  assert.match(
    atelierConfiguredEmptyMessage(result.emptyReason),
    /classe source/i,
  );
});

test("groupe avec source + 2 liens matching curriculum → 2 cours", () => {
  const result = resolveAtelierConfiguredParentIds({
    sourceClasseId: "src-3a",
    sourceBranchId: "school-a",
    secondaryConfiguredCoursIds: ["sec-math", "sec-phys", "sec-chim"],
    atelierLinks: [
      link("atl-math-lab", "sec-math"),
      link("atl-phys-lab", "sec-phys"),
      link("atl-bio-lab", "sec-bio"),
    ],
  });
  assert.equal(result.emptyReason, null);
  assert.deepEqual(
    result.coursIds.sort(),
    ["atl-math-lab", "atl-phys-lab"].sort(),
  );
});

test("cours lié hors option de la classe source → exclu si curriculum non vide", () => {
  const result = resolveAtelierConfiguredParentIds({
    sourceClasseId: "src-3a",
    sourceBranchId: "school-a",
    secondaryConfiguredCoursIds: ["sec-math"],
    atelierLinks: [
      link("atl-math-lab", "sec-math"),
      link("atl-latin", "sec-latin"),
    ],
  });
  assert.deepEqual(result.coursIds, ["atl-math-lab"]);
  assert.equal(result.emptyReason, null);
});

test("curriculum vide → repli sur les liens de la même école", () => {
  const result = resolveAtelierConfiguredParentIds({
    sourceClasseId: "src-3a",
    sourceBranchId: "school-a",
    secondaryConfiguredCoursIds: [],
    atelierLinks: [
      link("atl-1", "sec-math", "school-a"),
      link("atl-2", "sec-phys", "school-a"),
      link("atl-other", "sec-x", "school-b"),
    ],
  });
  assert.equal(result.emptyReason, null);
  assert.deepEqual(result.coursIds.sort(), ["atl-1", "atl-2"].sort());
});

test("aucun lien curriculum ni école → NO_MATCHING_LINKS", () => {
  const result = resolveAtelierConfiguredParentIds({
    sourceClasseId: "src-3a",
    sourceBranchId: "school-a",
    secondaryConfiguredCoursIds: ["sec-math"],
    atelierLinks: [link("atl-bio", "sec-bio", "school-b")],
  });
  assert.deepEqual(result.coursIds, []);
  assert.equal(result.emptyReason, "NO_MATCHING_LINKS");
});

test("secondaire : configuredCoursIdsForClass inchangé (pondération)", () => {
  const ponderations = [
    { coursId: "c1", optionId: "opt-lit", level: "" },
    { coursId: "c2", optionId: "opt-lit", level: "3e" },
    { coursId: "c3", optionId: "opt-sci", level: "" },
  ];
  const forLit3e = new Set(
    configuredCoursIdsForClass(ponderations, {
      optionId: "opt-lit",
      level: "3e",
    }),
  );
  assert.ok(forLit3e.has("c1"));
  assert.ok(forLit3e.has("c2"));
  assert.equal(forLit3e.has("c3"), false);
});

console.log("\nAll atelier teaching courses tests passed.");
