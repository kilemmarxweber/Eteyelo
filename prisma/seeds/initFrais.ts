import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

const fraisData = [
  {
    nameFrais: "Frais de Scolarite 7eme Generale A",
    montantFrais: 500,
    classeCode: "7E-GEN-A",
    typeFraisCode: "SCOL",
    echeance: new Date("2026-12-31"),
    statusFrais: true,
  },
  {
    nameFrais: "Frais d'Inscription 7eme Generale A",
    montantFrais: 50,
    classeCode: "7E-GEN-A",
    typeFraisCode: "INSC",
    echeance: new Date("2026-10-31"),
    statusFrais: true,
  },
  {
    nameFrais: "Frais d'Examen 7eme Generale A",
    montantFrais: 25,
    classeCode: "7E-GEN-A",
    typeFraisCode: "EXAM",
    echeance: new Date("2027-05-31"),
    statusFrais: true,
  },
  {
    nameFrais: "Frais de Scolarite 5eme Biologie A",
    montantFrais: 500,
    classeCode: "5E-BIO-A",
    typeFraisCode: "SCOL",
    echeance: new Date("2026-12-31"),
    statusFrais: true,
  },
  {
    nameFrais: "Frais de Laboratoire 5eme Biologie A",
    montantFrais: 35,
    classeCode: "5E-BIO-A",
    typeFraisCode: "LABO",
    echeance: new Date("2026-11-30"),
    statusFrais: true,
  },
  {
    nameFrais: "Frais d'Inscription 5eme Biologie A",
    montantFrais: 30,
    classeCode: "5E-BIO-A",
    typeFraisCode: "INSC",
    echeance: new Date("2026-10-31"),
    statusFrais: true,
  },
  {
    nameFrais: "Frais de Scolarite 5eme Informatique A",
    montantFrais: 220000,
    classeCode: "5E-INFO-A",
    typeFraisCode: "SCOL",
    echeance: new Date("2026-12-31"),
    statusFrais: true,
  },
  {
    nameFrais: "Frais de Laboratoire Informatique 5eme A",
    montantFrais: 50000,
    classeCode: "5E-INFO-A",
    typeFraisCode: "LABO",
    echeance: new Date("2026-11-30"),
    statusFrais: true,
  },
  {
    nameFrais: "Frais d'Inscription 5eme Informatique A",
    montantFrais: 35000,
    classeCode: "5E-INFO-A",
    typeFraisCode: "INSC",
    echeance: new Date("2026-10-31"),
    statusFrais: true,
  },
  {
    nameFrais: "Frais de Tenue Uniforme",
    montantFrais: 12000,
    classeCode: "7E-GEN-A",
    typeFraisCode: "TENUE",
    echeance: new Date("2026-11-15"),
    statusFrais: true,
  },
  {
    nameFrais: "Frais de Fournitures Scolaires",
    montantFrais: 8000,
    classeCode: "7E-GEN-A",
    typeFraisCode: "FOURNI",
    echeance: new Date("2026-10-15"),
    statusFrais: true,
  },
];

function getPriority(typeCode: string) {
  switch (typeCode) {
    case "INSC":
    case "TENUE":
    case "FOURNI":
      return 1;
    case "SCOL":
      return 2;
    case "EXAM":
    case "LABO":
      return 3;
    default:
      return 99;
  }
}

export async function initFrais() {
  console.log("Initialisation des frais scolaires...");
  const branchId = await getSeedBranchId();

  const classes = await Prisma.classe.findMany({ where: { branchId } });
  const typeFrais = await Prisma.typeFrais.findMany({ where: { branchId } });

  const classeMap = new Map(classes.map((c) => [c.codeClasse, c.id]));
  const typeMap = new Map(typeFrais.map((t) => [t.codeType, t.id]));

  let createdCount = 0;

  for (const frais of fraisData) {
    const classeId = classeMap.get(frais.classeCode);
    const typeFraisId = typeMap.get(frais.typeFraisCode);

    if (!classeId) {
      console.warn(`Classe ${frais.classeCode} introuvable`);
      continue;
    }

    if (!typeFraisId) {
      console.warn(`Type ${frais.typeFraisCode} introuvable`);
      continue;
    }

    const existing = await Prisma.frais.findFirst({
      where: {
        nameFrais: frais.nameFrais,
        classeId,
        branchId,
      },
    });

    if (!existing) {
      await Prisma.frais.create({
        data: {
          nameFrais: frais.nameFrais,
          montantFrais: frais.montantFrais,
          classeId,
          typeFraisId,
          echeance: frais.echeance,
          statusFrais: frais.statusFrais,
          branchId,
          priority: getPriority(frais.typeFraisCode),
        },
      });

      createdCount++;
    }
  }

  console.log(`OK ${createdCount} frais crees`);
}

export async function clearFrais() {
  console.log("Suppression des frais...");
  await Prisma.frais.deleteMany({});
  console.log("OK frais supprimes");
}
