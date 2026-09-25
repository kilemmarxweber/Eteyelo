import { prisma } from "../lib/prisma";
import { getConfiguredCoursIdsForAtelierGroupe } from "../lib/atelier-teaching-courses";

async function main() {
  const atelier = await prisma.branch.findFirst({
    where: { typebranch: "ATELIER", isActive: true },
    select: { id: true, name: true },
  });
  if (!atelier) {
    console.log("no atelier");
    return;
  }

  const links = await prisma.atelierCourseLink.findMany({
    where: { atelierCours: { branchId: atelier.id } },
    select: {
      atelierCoursId: true,
      secondaryCoursId: true,
      secondaryCours: { select: { nameCours: true, branchId: true } },
      atelierCours: { select: { nameCours: true } },
    },
  });
  console.log("atelier", atelier.name, "links", links.length);
  for (const l of links) {
    console.log({
      atl: l.atelierCours.nameCours,
      sec: l.secondaryCours.nameCours,
      secBranch: l.secondaryCours.branchId,
    });
  }

  const groupes = await prisma.classe.findMany({
    where: { branchId: atelier.id },
    select: {
      id: true,
      nameClasse: true,
      sourceClasseId: true,
      sourceClasse: {
        select: {
          nameClasse: true,
          optionId: true,
          level: true,
          branchId: true,
        },
      },
    },
    take: 8,
  });

  for (const g of groupes) {
    const resolved = await getConfiguredCoursIdsForAtelierGroupe({
      atelierBranchId: atelier.id,
      groupeId: g.id,
    });
    console.log({
      groupe: g.nameClasse,
      source: g.sourceClasse?.nameClasse ?? null,
      sourceBranch: g.sourceClasse?.branchId ?? null,
      coursIds: resolved.coursIds.length,
      reason: resolved.emptyReason,
    });
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
