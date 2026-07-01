import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

export const classesData = [
  {
    codeClasse: "7E-GEN-A",
    nameClasse: "7eme A Cycle d'orientation",
    optionCode: "CYC-ORIEN",
    creneauName: "Horaire Standard Matin",
    statusClasse: true,
  },
  {
    codeClasse: "7E-GEN-B",
    nameClasse: "7eme B Cycle d'orientation",
    optionCode: "CYC-ORIEN",
    creneauName: "Horaire Standard Matin",
    statusClasse: true,
  },
  {
    codeClasse: "8E-GEN-A",
    nameClasse: "8eme Cycle d'orientation",
    optionCode: "CYC-ORIEN",
    creneauName: "Horaire Standard Matin",
    statusClasse: true,
  },
  {
    codeClasse: "5E-BIO-A",
    nameClasse: "5eme Bio-Chimie A",
    optionCode: "BIO-CHI",
    creneauName: "Horaire Standard Matin",
    statusClasse: true,
  },
  {
    codeClasse: "6E-BIO-A",
    nameClasse: "6eme Biologie-Chimie A",
    optionCode: "BIO-CHI",
    creneauName: "Horaire Standard Matin",
    statusClasse: true,
  },
  {
    codeClasse: "5E-MATH-A",
    nameClasse: "5eme Mathematiques-Physique A",
    optionCode: "MATH-PHYS",
    creneauName: "Horaire Standard Matin",
    statusClasse: true,
  },
  {
    codeClasse: "6E-MATH-A",
    nameClasse: "6eme Mathematiques-Physique A",
    optionCode: "MATH-PHYS",
    creneauName: "Horaire Standard Apres-midi",
    statusClasse: true,
  },
  {
    codeClasse: "5E-INFO-A",
    nameClasse: "5eme Informatique de gestion A",
    optionCode: "INFO-GEST",
    creneauName: "Horaire Standard Matin",
    statusClasse: true,
  },
  {
    codeClasse: "5E-COMM-A",
    nameClasse: "5eme Commercial et Gestion A",
    optionCode: "COMM-GEST",
    creneauName: "Horaire Standard Matin",
    statusClasse: true,
  },
  {
    codeClasse: "6E-COMM-A",
    nameClasse: "6eme Commercial et Gestion A",
    optionCode: "COMM-GEST",
    creneauName: "Horaire Standard Apres-midi",
    statusClasse: true,
  },
];

export async function initClasses() {
  console.log("Initialisation des classes...");
  const branchId = await getSeedBranchId();

  const options = await Prisma.option.findMany({ where: { branchId } });
  const creneaux = await Prisma.creneau.findMany({ where: { branchId } });

  const optionMap = new Map(options.map((o) => [o.codeOption, o.id]));
  const creneauMap = new Map(creneaux.map((c) => [c.nameCreneau, c.id]));

  for (const classe of classesData) {
    const optionId = optionMap.get(classe.optionCode);
    const creneauId = creneauMap.get(classe.creneauName);

    if (!optionId) {
      console.warn(
        `Option ${classe.optionCode} non trouvee pour la classe ${classe.nameClasse}`,
      );
      continue;
    }

    if (!creneauId) {
      console.warn(
        `Creneau ${classe.creneauName} non trouve pour la classe ${classe.nameClasse}`,
      );
      continue;
    }

    await Prisma.classe.upsert({
      where: { codeClasse: classe.codeClasse },
      update: {
        nameClasse: classe.nameClasse,
        optionId,
        creneauId,
        statusClasse: classe.statusClasse,
        branchId,
      },
      create: {
        codeClasse: classe.codeClasse,
        nameClasse: classe.nameClasse,
        optionId,
        creneauId,
        statusClasse: classe.statusClasse,
        branchId,
      },
    });
  }

  console.log(`OK ${classesData.length} classes traitees`);
}

export async function clearClasses() {
  console.log("Suppression des classes...");
  await Prisma.classe.deleteMany({});
  console.log("OK classes supprimees");
}
