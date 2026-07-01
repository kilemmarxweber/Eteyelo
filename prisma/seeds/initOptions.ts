import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

export const optionsData = [
  {
    codeOption: "CYC-ORIEN",
    nameOption: "Cycle d'orientation",
    sectionCode: "HUM-GEN",
    statusOption: true,
  },
  {
    codeOption: "BIO-CHI",
    nameOption: "Biologie-Chimie",
    sectionCode: "SCIE",
    statusOption: true,
  },
  {
    codeOption: "MATH-PHYS",
    nameOption: "Mathematiques - Physique",
    sectionCode: "SCIE",
    statusOption: true,
  },
  {
    codeOption: "COMM-GEST",
    nameOption: "Commerciale et gestion",
    sectionCode: "COMM-AD",
    statusOption: true,
  },
  {
    codeOption: "COMM-SEC-ADM",
    nameOption: "Secretariat administratif",
    sectionCode: "COMM-AD",
    statusOption: true,
  },
  {
    codeOption: "COMM-COMPTE",
    nameOption: "Comptabilite",
    sectionCode: "COMM-AD",
    statusOption: true,
  },
  {
    codeOption: "TECH-ELEC-GEN",
    nameOption: "Electricite generale",
    sectionCode: "TECH",
    statusOption: true,
  },
  {
    codeOption: "TECH-MECA",
    nameOption: "Mecanique generale",
    sectionCode: "TECH",
    statusOption: true,
  },
  {
    codeOption: "TECH-CONSTR",
    nameOption: "Technique construction",
    sectionCode: "TECH",
    statusOption: true,
  },
  {
    codeOption: "TECH-ELEC",
    nameOption: "Electronique",
    sectionCode: "TECH",
    statusOption: true,
  },
  {
    codeOption: "INFO-GEST",
    nameOption: "Informatique de gestion",
    sectionCode: "TECH",
    statusOption: true,
  },
  {
    codeOption: "LATIN-PHILO",
    nameOption: "Latin - Philosophie",
    sectionCode: "LITT",
    statusOption: true,
  },
  {
    codeOption: "LETT-PHIL",
    nameOption: "Philosophie - Lettres",
    sectionCode: "LITT",
    statusOption: true,
  },
  {
    codeOption: "PED-GEN",
    nameOption: "Pedagogie generale",
    sectionCode: "PEDA",
    statusOption: true,
  },
  {
    codeOption: "PED-SCIE",
    nameOption: "Pedagogie des sciences",
    sectionCode: "PEDA",
    statusOption: true,
  },
  {
    codeOption: "PED-LAN",
    nameOption: "Pedagogie des langues",
    sectionCode: "PEDA",
    statusOption: true,
  },
];

export async function initOptions() {
  console.log("Initialisation des options...");
  const branchId = await getSeedBranchId();

  const sections = await Prisma.section.findMany({
    where: { branchId },
  });
  const sectionMap = new Map(sections.map((s) => [s.codeSection, s.id]));

  for (const option of optionsData) {
    const sectionId = sectionMap.get(option.sectionCode);
    if (!sectionId) {
      console.warn(
        `Section ${option.sectionCode} non trouvee pour l'option ${option.nameOption}`,
      );
      continue;
    }

    await Prisma.option.upsert({
      where: { codeOption: option.codeOption },
      update: {
        nameOption: option.nameOption,
        sectionId,
        statusOption: option.statusOption,
        branchId,
      },
      create: {
        codeOption: option.codeOption,
        nameOption: option.nameOption,
        sectionId,
        statusOption: option.statusOption,
        branchId,
      },
    });
  }

  console.log(`OK ${optionsData.length} options traitees`);
}

export async function clearOptions() {
  console.log("Suppression des options...");
  await Prisma.option.deleteMany({});
  console.log("OK options supprimees");
}
