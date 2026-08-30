import { prisma } from "@/lib/prisma";
import {
  upsertAngolaPrimaryCoursesForAllAngolaBranches,
  upsertAngolaPrimaryCoursesForBranch,
} from "@/lib/angola-primary-catalog-sync";

type SeedRow = {
  branchId: string;
  name: string;
  code: string | null;
  coursesCreated: number;
  coursesUpdated: number;
  coursesSkipped: number;
  ponderationsCreated: number;
  ponderationsUpdated: number;
  ponderationsSkipped: number;
};

function logRows(rows: SeedRow[]) {
  for (const row of rows) {
    console.log(
      `  ${row.name} (${row.code ?? row.branchId}): ` +
        `${row.coursesCreated} créé(s), ${row.coursesUpdated} mis à jour, ${row.coursesSkipped} déjà présents` +
        ` · pondérations ${row.ponderationsCreated}/${row.ponderationsUpdated}/${row.ponderationsSkipped}`,
    );
  }
}

export async function seedAngolaPrimaryCourses() {
  console.log("Seed cours 1.º ciclo primário (1ª–4ª)...");
  const requestedId = process.env.ANGOLA_SEED_BRANCH_ID?.trim();

  let results: SeedRow[] = [];

  if (requestedId) {
    const branch = await prisma.branch.findFirst({
      where: { id: requestedId },
      select: {
        id: true,
        name: true,
        code: true,
        typebranch: true,
        educationSystem: true,
        cycles: {
          where: { cycle: "PRIMAIRE", isActive: true },
          select: { id: true },
        },
      },
    });
    const isAngolaPrimary =
      branch?.educationSystem === "ANGOLAIS" &&
      (branch.typebranch === "PRIMAIRE" || branch.cycles.length > 0);
    if (isAngolaPrimary && branch) {
      results = [
        {
          ...(await upsertAngolaPrimaryCoursesForBranch(branch.id)),
          name: branch.name,
          code: branch.code,
        },
      ];
    } else {
      console.log(
        `  ANGOLA_SEED_BRANCH_ID n'est pas une branche primaire angolaise — seed de toutes les branches PRIMAIRE ANGOLAIS.`,
      );
      results = await upsertAngolaPrimaryCoursesForAllAngolaBranches();
    }
  } else {
    results = await upsertAngolaPrimaryCoursesForAllAngolaBranches();
  }

  if (results.length === 0) {
    console.log(
      "  Aucune branche primaire angolaise active. Créez-en une ou définissez ANGOLA_SEED_BRANCH_ID.",
    );
    return results;
  }

  logRows(results);
  return results;
}

if (process.argv[1]?.includes("seedAngolaPrimaryCourses")) {
  seedAngolaPrimaryCourses()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
