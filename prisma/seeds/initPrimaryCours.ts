import "dotenv/config";
import { prisma as Prisma } from "@/lib/prisma";
import { upsertPrimaryCatalogCoursesForAllPrimaryBranches } from "@/lib/primary-catalog-sync";
import { PRIMARY_COURSE_CATALOG } from "@/lib/primary-domains";

/**
 * Seed : pousse le catalogue des cours primaire RDC (5 domaines)
 * dans toutes les branches PRIMAIRE actives.
 *
 * Usage: pnpm run seed:primary-cours
 *    or: pnpm run seed --init primaryCours
 */
export async function initPrimaryCours() {
  console.log("📚 Import catalogue cours primaire RDC (5 domaines)...");
  console.log(`   ${PRIMARY_COURSE_CATALOG.length} matières au catalogue\n`);

  const results = await upsertPrimaryCatalogCoursesForAllPrimaryBranches();

  if (results.length === 0) {
    console.warn("⚠️  Aucune branche PRIMAIRE active trouvée.");
    return;
  }

  for (const r of results) {
    console.log(
      `✅ ${r.name} (${r.code}): +${r.created} créés, ${r.updated} mis à jour, ${r.skipped} inchangés`,
    );
  }

  console.log(`\n🎉 ${results.length} branche(s) primaire traitée(s).`);
}

export async function clearPrimaryCatalogCours() {
  console.log(
    "🗑️  Suppression des cours au code catalogue PRI* (branches primaire)...",
  );
  const branches = await Prisma.branch.findMany({
    where: { typebranch: "PRIMAIRE" },
    select: { id: true },
  });
  const branchIds = branches.map((b) => b.id);
  if (branchIds.length === 0) {
    console.log("Rien à supprimer.");
    return;
  }
  const deleted = await Prisma.cours.deleteMany({
    where: {
      branchId: { in: branchIds },
      codeCours: { startsWith: "PRI" },
    },
  });
  console.log(`✅ ${deleted.count} cours catalogue supprimés.`);
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").includes("initPrimaryCours");

if (isDirectRun) {
  initPrimaryCours()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await Prisma.$disconnect();
    });
}
