import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";
import { upsertSecondaryCatalogCoursesForBranch } from "@/lib/secondary-catalog-sync";
import { SECONDARY_COURSE_CATALOG } from "@/lib/secondary-course-catalog";

/* @deprecated Utiliser SECONDARY_COURSE_CATALOG — conservé pour référence / scripts legacy */
export { SECONDARY_COURSE_CATALOG as coursData };

/* ================= INIT ================= */

export async function initCours() {
  const branchId = await getSeedBranchId();
  console.log("📖 Initialisation des cours (catalogue secondaire RDC)...");
  console.log(`   ${SECONDARY_COURSE_CATALOG.length} matières au catalogue\n`);

  const result = await upsertSecondaryCatalogCoursesForBranch(branchId);

  console.log(
    `✅ Cours : +${result.coursesCreated} créés, ${result.coursesUpdated} mis à jour, ${result.coursesSkipped} inchangés`,
  );
  console.log(
    `✅ Pondérations : +${result.ponderationsCreated} créées, ${result.ponderationsUpdated} mises à jour, ${result.ponderationsSkipped} inchangées`,
  );
}

/* ================= CLEAR ================= */

export async function clearCours() {
  console.log("🗑️ Suppression des cours...");

  try {
    await Prisma.cours.deleteMany({});
    console.log("✅ Cours supprimés");
  } catch (err) {
    console.error("❌ erreur suppression cours", err);
  }
}
