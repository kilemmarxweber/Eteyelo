import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

export const typeFraisData = [
  {
    codeType: "SCOL",
    nameType: "Frais de Scolarité",
    description: "Frais de scolarité annuels ou mensuels",
    statusType: true,
  },
  {
    codeType: "INSC",
    nameType: "Frais d'Inscription",
    description: "Frais d'inscription en début d'année",
    statusType: true,
  },
  {
    codeType: "EXAM",
    nameType: "Frais d'Examen",
    description: "Frais pour les examens de fin d'année",
    statusType: true,
  },
  {
    codeType: "TENUE",
    nameType: "Frais de Tenue",
    description: "Frais pour l'uniforme scolaire",
    statusType: true,
  },
  {
    codeType: "FOURNI",
    nameType: "Frais de Fournitures",
    description: "Frais pour les fournitures scolaires",
    statusType: true,
  },
  {
    codeType: "BIBLIO",
    nameType: "Frais de Bibliothèque",
    description: "Frais d'accès à la bibliothèque",
    statusType: true,
  },
  {
    codeType: "LABO",
    nameType: "Frais de Laboratoire",
    description: "Frais d'utilisation des laboratoires",
    statusType: true,
  },
  {
    codeType: "TRANS",
    nameType: "Frais de Transport",
    description: "Frais de transport scolaire",
    statusType: true,
  },
  {
    codeType: "CANTINE",
    nameType: "Frais de Cantine",
    description: "Frais de restauration scolaire",
    statusType: true,
  },
  {
    codeType: "ACTIVITE",
    nameType: "Frais d'Activités",
    description: "Frais pour les activités extra-scolaires",
    statusType: true,
  },
];

export async function initTypeFrais() {
  const branchId = await getSeedBranchId();
  console.log("💰 Initialisation des types de frais...");

  for (const typeFrais of typeFraisData) {
    await Prisma.typeFrais.upsert({
      where: { codeType: typeFrais.codeType },
      update: {
        ...typeFrais,
        branchId,
      },
      create: {
        ...typeFrais,
        branchId,
      },
    });
  }

  console.log(`✅ ${typeFraisData.length} types de frais créés`);
}

export async function clearTypeFrais() {
  console.log("🗑️  Suppression des types de frais...");
  await Prisma.typeFrais.deleteMany({});
  console.log("✅ Types de frais supprimés");
}
