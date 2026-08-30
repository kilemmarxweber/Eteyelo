import { prisma } from "@/lib/prisma";
import {
  upsertAngolaSecondaryCoursesForAllAngolaBranches,
  upsertAngolaSecondaryCoursesForBranch,
} from "@/lib/angola-secondary-catalog-sync";

export async function seedAngolaPortuguesaCourses() {
  console.log("Seed cours PORTUGUESA (7ª–13ª)...");
  const requestedId = process.env.ANGOLA_SEED_BRANCH_ID?.trim();
  const results = requestedId
    ? [
        {
          ...(await upsertAngolaSecondaryCoursesForBranch(requestedId)),
          name: requestedId,
          code: null as string | null,
        },
      ]
    : await upsertAngolaSecondaryCoursesForAllAngolaBranches();

  if (results.length === 0) {
    console.log(
      "  Aucune branche secondaire angolaise active. Créez-en une ou définissez ANGOLA_SEED_BRANCH_ID.",
    );
    return results;
  }

  for (const row of results) {
    console.log(
      `  ${row.name} (${row.code ?? row.branchId}): ` +
        `${row.coursesCreated} créé(s), ${row.coursesUpdated} mis à jour, ${row.coursesSkipped} déjà présents` +
        ` · pondérations ${row.ponderationsCreated}/${row.ponderationsUpdated}/${row.ponderationsSkipped}`,
    );
  }

  return results;
}

if (process.argv[1]?.includes("seedAngolaPortuguesaCourses")) {
  seedAngolaPortuguesaCourses()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
