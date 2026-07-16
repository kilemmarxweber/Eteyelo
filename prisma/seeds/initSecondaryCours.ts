import "dotenv/config";
import { prisma as Prisma } from "@/lib/prisma";
import { upsertSecondaryCatalogCoursesForAllSecondaryBranches } from "@/lib/secondary-catalog-sync";
import { SECONDARY_COURSE_CATALOG } from "@/lib/secondary-course-catalog";

/**
 * Seed : pousse le catalogue des cours secondaire RDC
 * dans toutes les branches SECONDAIRE actives.
 *
 * Usage: pnpm run seed:secondary-cours
 *    or: pnpm run seed --init secondaryCours
 */
export async function initSecondaryCours() {
  console.log("📚 Import catalogue cours secondaire RDC...");
  console.log(`   ${SECONDARY_COURSE_CATALOG.length} matières au catalogue\n`);

  const results = await upsertSecondaryCatalogCoursesForAllSecondaryBranches();

  if (results.length === 0) {
    console.warn("⚠️  Aucune branche SECONDAIRE active trouvée.");
    return;
  }

  for (const r of results) {
    console.log(
      `✅ ${r.name} (${r.code}): +${r.coursesCreated} cours, ${r.ponderationsCreated} pondération(s)`,
    );
  }

  console.log(`\n🎉 ${results.length} branche(s) secondaire traitée(s).`);
}

export async function clearSecondaryCatalogCours() {
  console.log(
    "🗑️  Suppression des cours catalogue secondaire (codes du catalogue)...",
  );
  const branches = await Prisma.branch.findMany({
    where: { typebranch: "SECONDAIRE" },
    select: { id: true },
  });
  const branchIds = branches.map((b) => b.id);
  if (branchIds.length === 0) {
    console.log("Rien à supprimer.");
    return;
  }

  const codes = SECONDARY_COURSE_CATALOG.map((c) => c.codeCours);
  const deleted = await Prisma.cours.deleteMany({
    where: {
      branchId: { in: branchIds },
      codeCours: { in: codes },
    },
  });
  console.log(`✅ ${deleted.count} cours catalogue supprimés.`);
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").includes("initSecondaryCours");

if (isDirectRun) {
  initSecondaryCours()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await Prisma.$disconnect();
    });
}
