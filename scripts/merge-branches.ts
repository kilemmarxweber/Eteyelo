/**
 * Fusionne une branche source dans une branche cible (même organisation).
 *
 * Usage :
 *   pnpm tsx scripts/merge-branches.ts --source <id> --target <id> --dry-run
 *   pnpm tsx scripts/merge-branches.ts --source <id> --target <id>
 *
 * --dry-run est le mode par défaut. Passez --apply pour écrire.
 */
import { prisma } from "../lib/prisma";
import { ensureAcademicPeriodsForBranch } from "../lib/academic-periods";
import { persistActivatedBranchCycles } from "../lib/persist-branch-cycles";
import { normalizeCycle, type Cycle } from "../lib/cycle";

const args = process.argv.slice(2);
function flag(name: string) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}
const apply = args.includes("--apply");
const dryRun = !apply;
const sourceId = flag("--source");
const targetId = flag("--target");

type Conflict = { kind: string; message: string };

async function main() {
  if (!sourceId || !targetId) {
    console.error(
      "Usage: tsx scripts/merge-branches.ts --source <branchId> --target <branchId> [--dry-run|--apply]",
    );
    process.exit(1);
  }
  if (sourceId === targetId) {
    throw new Error("Source et cible doivent être distinctes.");
  }

  const [source, target] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: sourceId },
      include: {
        cycles: true,
        _count: {
          select: {
            classes: true,
            frais: true,
          },
        },
      },
    }),
    prisma.branch.findUnique({
      where: { id: targetId },
      include: { cycles: true },
    }),
  ]);

  if (!source || !target) {
    throw new Error("Branche source ou cible introuvable.");
  }
  if (source.organizationId !== target.organizationId) {
    throw new Error("Les deux branches doivent appartenir à la même organisation.");
  }

  const sourceCycle = normalizeCycle(source.typebranch);
  const mergedCycles: Cycle[] = [
    ...new Set([
      normalizeCycle(target.typebranch),
      sourceCycle,
      ...target.cycles.map((row) => normalizeCycle(row.cycle)),
      ...source.cycles.map((row) => normalizeCycle(row.cycle)),
    ]),
  ];

  const conflicts: Conflict[] = [];
  const plan: string[] = [];

  plan.push(`Source : ${source.name} (${source.typebranch}, ${source.id})`);
  plan.push(`Cible  : ${target.name} (${target.typebranch}, ${target.id})`);
  plan.push(`Cycles fusionnés : ${mergedCycles.join(", ")}`);
  plan.push(`Mode : ${dryRun ? "DRY-RUN" : "APPLY"}`);

  const [sourceYears, targetYears] = await Promise.all([
    prisma.schoolYear.findMany({ where: { branchId: sourceId } }),
    prisma.schoolYear.findMany({ where: { branchId: targetId } }),
  ]);
  const yearMap = new Map<string, string>();
  for (const year of sourceYears) {
    const match = targetYears.find((item) => item.nameYear === year.nameYear);
    if (match) {
      yearMap.set(year.id, match.id);
      plan.push(`Année « ${year.nameYear} » : remap ${year.id} → ${match.id}`);
    } else {
      plan.push(`Année « ${year.nameYear} » : à créer sur la cible`);
    }
  }

  const [sourceClasses, targetClasses] = await Promise.all([
    prisma.classe.findMany({ where: { branchId: sourceId } }),
    prisma.classe.findMany({ where: { branchId: targetId } }),
  ]);
  for (const classe of sourceClasses) {
    const nameClash = targetClasses.find(
      (item) => item.nameClasse === classe.nameClasse,
    );
    const codeClash = targetClasses.find(
      (item) => item.codeClasse === classe.codeClasse,
    );
    if (nameClash) {
      conflicts.push({
        kind: "classe-name",
        message: `Nom de classe « ${classe.nameClasse} » déjà présent sur la cible`,
      });
    }
    if (codeClash) {
      conflicts.push({
        kind: "classe-code",
        message: `Code classe « ${classe.codeClasse} » déjà présent sur la cible`,
      });
    }
  }
  plan.push(
    `${sourceClasses.length} classe(s) à déplacer avec cycle=${sourceCycle}`,
  );

  const sourceEnrollments = await prisma.classEnrollment.findMany({
    where: { branchId: sourceId },
    select: { studentId: true, schoolYearId: true, student: { select: { id: true } } },
  });
  for (const enrollment of sourceEnrollments) {
    const mappedYearId = yearMap.get(enrollment.schoolYearId) ?? enrollment.schoolYearId;
    const clash = await prisma.classEnrollment.findFirst({
      where: {
        branchId: targetId,
        studentId: enrollment.studentId,
        schoolYearId: mappedYearId,
      },
      select: { id: true },
    });
    if (clash) {
      conflicts.push({
        kind: "enrollment",
        message: `Élève ${enrollment.studentId} déjà inscrit sur la cible pour la même année`,
      });
    }
  }

  const sourcePayments = await prisma.familyPayment.findMany({
    where: { branchId: sourceId },
    select: { transactionRef: true },
  });
  const refs = sourcePayments
    .map((item) => item.transactionRef)
    .filter((value): value is string => Boolean(value));
  if (refs.length) {
    const clash = await prisma.familyPayment.findMany({
      where: { branchId: targetId, transactionRef: { in: refs } },
      select: { transactionRef: true },
    });
    for (const item of clash) {
      conflicts.push({
        kind: "payment-ref",
        message: `transactionRef ${item.transactionRef} déjà présent sur la cible`,
      });
    }
  }

  console.log(plan.join("\n"));
  console.log(`\nConflits : ${conflicts.length}`);
  for (const conflict of conflicts) {
    console.log(` - [${conflict.kind}] ${conflict.message}`);
  }

  if (dryRun) {
    console.log(
      "\nDry-run terminé. Relancez avec --apply après résolution des conflits.",
    );
    return;
  }

  if (conflicts.length) {
    throw new Error(
      "Fusion bloquée : résolvez les conflits ci-dessus avant --apply.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await persistActivatedBranchCycles(tx, targetId, mergedCycles);
    await ensureAcademicPeriodsForBranch({
      branchId: targetId,
      typebranch: target.typebranch,
      educationSystem: target.educationSystem,
      cycles: mergedCycles,
    });

    for (const year of sourceYears) {
      if (yearMap.has(year.id)) continue;
      const created = await tx.schoolYear.create({
        data: {
          nameYear: year.nameYear,
          startYear: year.startYear,
          endYear: year.endYear,
          isCurrentYear: false,
          branchId: targetId,
        },
      });
      yearMap.set(year.id, created.id);
    }

    for (const [from, to] of yearMap) {
      if (from === to) continue;
      await tx.classEnrollment.updateMany({
        where: { branchId: sourceId, schoolYearId: from },
        data: { schoolYearId: to },
      });
      await tx.frais.updateMany({
        where: { branchId: sourceId, schoolYearId: from },
        data: { schoolYearId: to },
      });
      await tx.fiche.updateMany({
        where: { branchId: sourceId, anneeId: from },
        data: { anneeId: to },
      });
    }

    await tx.section.updateMany({
      where: { branchId: sourceId },
      data: { branchId: targetId, cycle: sourceCycle },
    });
    await tx.option.updateMany({
      where: { branchId: sourceId },
      data: { branchId: targetId, cycle: sourceCycle },
    });
    await tx.classe.updateMany({
      where: { branchId: sourceId },
      data: { branchId: targetId, cycle: sourceCycle },
    });

    const sourcePeriods = await tx.period.findMany({
      where: { branchId: sourceId },
      include: { semester: true },
    });
    const targetPeriods = await tx.period.findMany({
      where: { branchId: targetId, cycle: sourceCycle },
    });
    const periodMap = new Map<number, number>();
    for (const period of sourcePeriods) {
      const match = targetPeriods.find(
        (item) => item.label === period.label && item.cycle === sourceCycle,
      );
      if (match) periodMap.set(period.id, match.id);
    }

    for (const [from, to] of periodMap) {
      await tx.fiche.updateMany({
        where: { branchId: sourceId, periodId: from },
        data: { periodId: to, branchId: targetId },
      });
    }

    await tx.classEnrollment.updateMany({
      where: { branchId: sourceId },
      data: { branchId: targetId },
    });
    await tx.frais.updateMany({
      where: { branchId: sourceId },
      data: { branchId: targetId },
    });
    await tx.familyPayment.updateMany({
      where: { branchId: sourceId },
      data: { branchId: targetId },
    });
    await tx.typeFrais.updateMany({
      where: { branchId: sourceId },
      data: { branchId: targetId, cycle: sourceCycle },
    });

    await tx.branch.update({
      where: { id: sourceId },
      data: { isActive: false },
    });
  });

  console.log("\nFusion appliquée. Branche source archivée (isActive=false).");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
