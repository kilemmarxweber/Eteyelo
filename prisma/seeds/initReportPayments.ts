import {
  PaymentMethod,
  PaymentStatus,
} from "@/prisma/generated/prisma/client";
import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

function atDayOffset(daysAgo: number, hour = 10) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function normalizeUsername(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Frais manquants pour couvrir toutes les classes des rapports impayés. */
const extraFraisData = [
  {
    nameFrais: "Frais de Scolarite 7eme Generale B",
    montantFrais: 500,
    classeCode: "7E-GEN-B",
    typeFraisCode: "SCOL",
    echeance: new Date("2026-12-31"),
  },
  {
    nameFrais: "Frais d'Inscription 7eme Generale B",
    montantFrais: 50,
    classeCode: "7E-GEN-B",
    typeFraisCode: "INSC",
    echeance: new Date("2026-10-31"),
  },
  {
    nameFrais: "Frais de Scolarite 5eme Mathematiques A",
    montantFrais: 500,
    classeCode: "5E-MATH-A",
    typeFraisCode: "SCOL",
    echeance: new Date("2026-12-31"),
  },
  {
    nameFrais: "Frais d'Inscription 5eme Mathematiques A",
    montantFrais: 40,
    classeCode: "5E-MATH-A",
    typeFraisCode: "INSC",
    echeance: new Date("2026-10-31"),
  },
];

type PaymentSeed = {
  studentUsername: string;
  fraisName: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  daysAgo: number;
  notes?: string;
  refSuffix: string;
};

/**
 * Scénarios pour tester :
 * - A_JOUR / PARTIEL / EN_RETARD (impayés)
 * - modes de paiement variés (liste + caisse)
 * - dates récentes dont aujourd'hui (rapport caisse défaut)
 * - statut ANNULE / EN_ATTENTE (filtres liste)
 */
const paymentSeeds: PaymentSeed[] = [
  // 7E-GEN-A — Kasongo = à jour (inscription + scolarité + uniforme + fournitures + examen)
  {
    studentUsername: "eleve.kasongo.junior",
    fraisName: "Frais d'Inscription 7eme Generale A",
    amount: 50,
    method: PaymentMethod.ESPECES,
    status: PaymentStatus.VALIDE,
    daysAgo: 60,
    notes: "Inscription complète",
    refSuffix: "KAS-INSC",
  },
  {
    studentUsername: "eleve.kasongo.junior",
    fraisName: "Frais de Scolarite 7eme Generale A",
    amount: 500,
    method: PaymentMethod.MPESA,
    status: PaymentStatus.VALIDE,
    daysAgo: 30,
    notes: "Scolarité annuelle",
    refSuffix: "KAS-SCOL",
  },
  {
    studentUsername: "eleve.kasongo.junior",
    fraisName: "Frais de Tenue Uniforme",
    amount: 12000,
    method: PaymentMethod.AIRTEL_MONEY,
    status: PaymentStatus.VALIDE,
    daysAgo: 14,
    refSuffix: "KAS-TENUE",
  },
  {
    studentUsername: "eleve.kasongo.junior",
    fraisName: "Frais de Fournitures Scolaires",
    amount: 8000,
    method: PaymentMethod.ESPECES,
    status: PaymentStatus.VALIDE,
    daysAgo: 7,
    refSuffix: "KAS-FOURNI",
  },
  {
    studentUsername: "eleve.kasongo.junior",
    fraisName: "Frais d'Examen 7eme Generale A",
    amount: 25,
    method: PaymentMethod.ORANGE_MONEY,
    status: PaymentStatus.VALIDE,
    daysAgo: 0,
    notes: "Paiement du jour — test caisse",
    refSuffix: "KAS-EXAM-TODAY",
  },

  // Kalombo = partiel (inscription + moitié scolarité)
  {
    studentUsername: "eleve.kalombo.grace",
    fraisName: "Frais d'Inscription 7eme Generale A",
    amount: 50,
    method: PaymentMethod.ESPECES,
    status: PaymentStatus.VALIDE,
    daysAgo: 45,
    refSuffix: "KAL-INSC",
  },
  {
    studentUsername: "eleve.kalombo.grace",
    fraisName: "Frais de Scolarite 7eme Generale A",
    amount: 200,
    method: PaymentMethod.MPESA,
    status: PaymentStatus.VALIDE,
    daysAgo: 10,
    notes: "Acompte scolarité",
    refSuffix: "KAL-SCOL-PART",
  },
  {
    studentUsername: "eleve.kalombo.grace",
    fraisName: "Frais de Scolarite 7eme Generale A",
    amount: 100,
    method: PaymentMethod.BANQUE,
    status: PaymentStatus.EN_ATTENTE,
    daysAgo: 2,
    notes: "En attente validation banque",
    refSuffix: "KAL-SCOL-WAIT",
  },

  // Mukendi Sarah = en retard (aucun paiement VALIDE) — seulement un annulé
  {
    studentUsername: "eleve.mukendi.sarah",
    fraisName: "Frais d'Inscription 7eme Generale A",
    amount: 50,
    method: PaymentMethod.ESPECES,
    status: PaymentStatus.ANNULE,
    daysAgo: 20,
    notes: "Paiement annulé — test filtre",
    refSuffix: "SAR-INSC-CXL",
  },

  // 5E-BIO-A — Mulumba à jour, Mwamba partiel
  {
    studentUsername: "eleve.mulumba.prince",
    fraisName: "Frais d'Inscription 5eme Biologie A",
    amount: 30,
    method: PaymentMethod.ESPECES,
    status: PaymentStatus.VALIDE,
    daysAgo: 50,
    refSuffix: "MUL-INSC",
  },
  {
    studentUsername: "eleve.mulumba.prince",
    fraisName: "Frais de Scolarite 5eme Biologie A",
    amount: 500,
    method: PaymentMethod.CARTE,
    status: PaymentStatus.VALIDE,
    daysAgo: 5,
    refSuffix: "MUL-SCOL",
  },
  {
    studentUsername: "eleve.mulumba.prince",
    fraisName: "Frais de Laboratoire 5eme Biologie A",
    amount: 35,
    method: PaymentMethod.ESPECES,
    status: PaymentStatus.VALIDE,
    daysAgo: 0,
    notes: "Labo — paiement du jour",
    refSuffix: "MUL-LABO-TODAY",
  },
  {
    studentUsername: "eleve.mwamba.esther",
    fraisName: "Frais d'Inscription 5eme Biologie A",
    amount: 30,
    method: PaymentMethod.MPESA,
    status: PaymentStatus.VALIDE,
    daysAgo: 40,
    refSuffix: "MWA-INSC",
  },
  {
    studentUsername: "eleve.mwamba.esther",
    fraisName: "Frais de Scolarite 5eme Biologie A",
    amount: 150,
    method: PaymentMethod.ORANGE_MONEY,
    status: PaymentStatus.VALIDE,
    daysAgo: 3,
    notes: "Acompte",
    refSuffix: "MWA-SCOL-PART",
  },

  // 5E-INFO-A — partiel sur gros montants CDF
  {
    studentUsername: "eleve.tshilombo.joie",
    fraisName: "Frais d'Inscription 5eme Informatique A",
    amount: 35000,
    method: PaymentMethod.ESPECES,
    status: PaymentStatus.VALIDE,
    daysAgo: 25,
    refSuffix: "TSH-INSC",
  },
  {
    studentUsername: "eleve.tshilombo.joie",
    fraisName: "Frais de Scolarite 5eme Informatique A",
    amount: 80000,
    method: PaymentMethod.BANQUE,
    status: PaymentStatus.VALIDE,
    daysAgo: 1,
    notes: "Acompte scolarité INFO",
    refSuffix: "TSH-SCOL-PART",
  },

  // 7E-GEN-B — Ruth à jour partiel, Michel en retard
  {
    studentUsername: "eleve.kabongo.ruth",
    fraisName: "Frais d'Inscription 7eme Generale B",
    amount: 50,
    method: PaymentMethod.ESPECES,
    status: PaymentStatus.VALIDE,
    daysAgo: 35,
    refSuffix: "RUT-INSC",
  },
  {
    studentUsername: "eleve.kabongo.ruth",
    fraisName: "Frais de Scolarite 7eme Generale B",
    amount: 500,
    method: PaymentMethod.MPESA,
    status: PaymentStatus.VALIDE,
    daysAgo: 8,
    refSuffix: "RUT-SCOL",
  },

  // 5E-MATH-A — David partiel, Samuel à jour
  {
    studentUsername: "eleve.katanga.david",
    fraisName: "Frais d'Inscription 5eme Mathematiques A",
    amount: 40,
    method: PaymentMethod.ESPECES,
    status: PaymentStatus.VALIDE,
    daysAgo: 28,
    refSuffix: "DAV-INSC",
  },
  {
    studentUsername: "eleve.mputu.samuel",
    fraisName: "Frais d'Inscription 5eme Mathematiques A",
    amount: 40,
    method: PaymentMethod.AIRTEL_MONEY,
    status: PaymentStatus.VALIDE,
    daysAgo: 22,
    refSuffix: "SAM-INSC",
  },
  {
    studentUsername: "eleve.mputu.samuel",
    fraisName: "Frais de Scolarite 5eme Mathematiques A",
    amount: 500,
    method: PaymentMethod.ESPECES,
    status: PaymentStatus.VALIDE,
    daysAgo: 0,
    notes: "Scolarité — paiement du jour",
    refSuffix: "SAM-SCOL-TODAY",
  },
];

const expenseSeeds = [
  {
    refSuffix: "EXP-FOURN",
    amount: 45000,
    category: "Fournitures",
    description: "Achat cahiers et stylos bureau",
    daysAgo: 12,
  },
  {
    refSuffix: "EXP-ELEC",
    amount: 85000,
    category: "Électricité",
    description: "Facture SNEL mois en cours",
    daysAgo: 5,
  },
  {
    refSuffix: "EXP-ENTR",
    amount: 25000,
    category: "Entretien",
    description: "Réparation portes salles de classe",
    daysAgo: 2,
  },
  {
    refSuffix: "EXP-TRANS",
    amount: 15000,
    category: "Transport",
    description: "Carburant véhicule école",
    daysAgo: 0,
  },
  {
    refSuffix: "EXP-SAL",
    amount: 120000,
    category: "Salaires",
    description: "Avance salaire personnel administratif",
    daysAgo: 20,
  },
];

async function ensureExtraFrais(branchId: string) {
  const classes = await Prisma.classe.findMany({ where: { branchId } });
  const typeFrais = await Prisma.typeFrais.findMany({ where: { branchId } });
  const classeMap = new Map(classes.map((c) => [c.codeClasse, c.id]));
  const typeMap = new Map(typeFrais.map((t) => [t.codeType, t.id]));

  for (const frais of extraFraisData) {
    const classeId = classeMap.get(frais.classeCode);
    const typeFraisId = typeMap.get(frais.typeFraisCode);
    if (!classeId || !typeFraisId) continue;

    const existing = await Prisma.frais.findFirst({
      where: { nameFrais: frais.nameFrais, classeId, branchId },
    });

    if (!existing) {
      await Prisma.frais.create({
        data: {
          nameFrais: frais.nameFrais,
          montantFrais: frais.montantFrais,
          classeId,
          typeFraisId,
          echeance: frais.echeance,
          statusFrais: true,
          branchId,
          priority: frais.typeFraisCode === "INSC" ? 1 : 2,
        },
      });
    }
  }
}

export async function initReportPayments() {
  console.log("Initialisation des paiements & dépenses (rapports)...");
  const branchId = await getSeedBranchId();

  await ensureExtraFrais(branchId);

  const currentYear = await Prisma.schoolYear.findFirst({
    where: { branchId, isCurrentYear: true },
  });
  if (!currentYear) {
    throw new Error("Année scolaire courante introuvable pour les paiements.");
  }

  const enrollments = await Prisma.classEnrollment.findMany({
    where: { branchId, schoolYearId: currentYear.id },
    include: {
      student: {
        include: {
          parent: true,
          branchMember: {
            include: { member: { include: { user: true } } },
          },
        },
      },
      classe: true,
    },
  });

  const fraisList = await Prisma.frais.findMany({ where: { branchId } });
  const fraisByName = new Map(fraisList.map((f) => [f.nameFrais, f]));

  const enrollmentByStudent = new Map(
    enrollments.map((e) => [
      normalizeUsername(e.student.branchMember?.member?.user?.username),
      e,
    ]),
  );

  let paymentCount = 0;

  for (const seed of paymentSeeds) {
    const enrollment = enrollmentByStudent.get(
      normalizeUsername(seed.studentUsername),
    );
    const frais = fraisByName.get(seed.fraisName);

    if (!enrollment || !frais) {
      console.warn(
        `Paiement ignoré: ${seed.studentUsername} / ${seed.fraisName}`,
      );
      continue;
    }

    const parentId = enrollment.student.parentId;
    if (!parentId) {
      console.warn(`Parent manquant pour ${seed.studentUsername}`);
      continue;
    }

    const transactionRef = `SEED-PAY-${seed.refSuffix}`;
    const createdAt = atDayOffset(seed.daysAgo);

    const existing = await Prisma.familyPayment.findFirst({
      where: { branchId, transactionRef },
    });

    if (existing) {
      await Prisma.familyPayment.update({
        where: { id: existing.id },
        data: {
          amount: seed.amount,
          method: seed.method,
          status: seed.status,
          notes: seed.notes ?? null,
          parentId,
          fraisId: frais.id,
          classEnrollmentId: enrollment.id,
          createdAt,
          updatedAt: createdAt,
        },
      });
    } else {
      await Prisma.familyPayment.create({
        data: {
          amount: seed.amount,
          method: seed.method,
          status: seed.status,
          notes: seed.notes ?? null,
          parentId,
          fraisId: frais.id,
          classEnrollmentId: enrollment.id,
          transactionRef,
          branchId,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    paymentCount++;
  }

  let expenseCount = 0;
  for (const expense of expenseSeeds) {
    const transactionRef = `SEED-EXP-${expense.refSuffix}`;
    const createdAt = atDayOffset(expense.daysAgo, 14);

    const existing = await Prisma.cashierExpense.findFirst({
      where: { branchId, transactionRef },
    });

    if (existing) {
      await Prisma.cashierExpense.update({
        where: { id: existing.id },
        data: {
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          createdAt,
        },
      });
    } else {
      await Prisma.cashierExpense.create({
        data: {
          transactionRef,
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          branchId,
          createdAt,
        },
      });
    }
    expenseCount++;
  }

  console.log(
    `OK ${paymentCount} paiements et ${expenseCount} dépenses (rapports)`,
  );
}

export async function clearReportPayments() {
  console.log("Suppression des paiements & dépenses de rapports...");
  await Prisma.paymentAllocation.deleteMany({});
  await Prisma.paymentEvent.deleteMany({});
  await Prisma.mobileMoneyTransaction.deleteMany({});
  await Prisma.familyPayment.deleteMany({});
  await Prisma.paymentBatch.deleteMany({});
  await Prisma.cashierExpense.deleteMany({});
  console.log("OK paiements & dépenses supprimés");
}
