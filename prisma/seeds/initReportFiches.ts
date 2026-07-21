import { randomUUID } from "crypto";
import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

function normalizeUsername(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type NoteRow = {
  studentId: string;
  nom: string;
  studentSurname: string;
  studentusername: string;
  studentSexe: string;
  score: number;
  maxScore: number;
};

const FICHE_SPECS = [
  {
    teachingKey: "prof.mukendi-MATH-7E-GEN-A",
    typeFiche: "ficheCote",
    periodLabel: "1ere Periode",
    maxScore: 20,
    scoreByUsername: {
      "eleve.kasongo.junior": 16,
      "eleve.kalombo.grace": 14,
      "eleve.mukendi.sarah": 11,
    } as Record<string, number>,
  },
  {
    teachingKey: "prof.mbuyi-FRAN-7E-GEN-A",
    typeFiche: "ficheCote",
    periodLabel: "1ere Periode",
    maxScore: 20,
    scoreByUsername: {
      "eleve.kasongo.junior": 15,
      "eleve.kalombo.grace": 17,
      "eleve.mukendi.sarah": 12,
    } as Record<string, number>,
  },
  {
    teachingKey: "prof.ndaya-BIO-5E-BIO-A",
    typeFiche: "ficheCote",
    periodLabel: "1ere Periode",
    maxScore: 20,
    scoreByUsername: {
      "eleve.mulumba.prince": 13,
      "eleve.mwamba.esther": 18,
    } as Record<string, number>,
  },
  {
    teachingKey: "prof.tshimanga-PHYS-5E-MATH-A",
    typeFiche: "ficheCote",
    periodLabel: "2e Periode",
    maxScore: 20,
    scoreByUsername: {
      "eleve.katanga.david": 19,
      "eleve.mputu.samuel": 14,
    } as Record<string, number>,
  },
];

export async function initReportFiches() {
  console.log("Initialisation des fiches de notes (rapports)...");
  const branchId = await getSeedBranchId();

  const currentYear = await Prisma.schoolYear.findFirst({
    where: { branchId, isCurrentYear: true },
  });
  if (!currentYear) {
    throw new Error("Année scolaire courante introuvable pour les fiches.");
  }

  const periods = await Prisma.period.findMany({
    where: { branchId },
  });
  const periodMap = new Map(periods.map((p) => [p.label, p]));

  const teachings = await Prisma.teaching.findMany({
    where: { branchId, schoolYearId: currentYear.id },
    include: {
      teacher: {
        include: {
          branchMember: {
            include: { member: { include: { user: true } } },
          },
        },
      },
      cours: true,
      classe: true,
    },
  });

  const teachingMap = new Map<string, (typeof teachings)[number]>();
  for (const teaching of teachings) {
    const username = teaching.teacher?.branchMember?.member?.user?.username;
    const key = `${username}-${teaching.cours?.codeCours}-${teaching.classe?.codeClasse}`;
    if (username && teaching.cours?.codeCours && teaching.classe?.codeClasse) {
      teachingMap.set(key, teaching);
    }
  }

  const enrollments = await Prisma.classEnrollment.findMany({
    where: { branchId, schoolYearId: currentYear.id },
    include: {
      student: {
        include: {
          branchMember: {
            include: { member: { include: { user: true } } },
          },
        },
      },
    },
  });

  let createdCount = 0;

  for (const spec of FICHE_SPECS) {
    const teaching = teachingMap.get(spec.teachingKey);
    const period = periodMap.get(spec.periodLabel);

    if (!teaching || !period || !teaching.classe || !teaching.cours) {
      console.warn(`Fiche ignorée: ${spec.teachingKey} / ${spec.periodLabel}`);
      continue;
    }

    const classEnrollments = enrollments.filter(
      (e) => e.classeId === teaching.classeId,
    );

    const notes: NoteRow[] = classEnrollments.map((enrollment) => {
      const user = enrollment.student.branchMember?.member?.user;
      const username = normalizeUsername(user?.username);
      const score =
        spec.scoreByUsername[username] ??
        Math.round(spec.maxScore * (0.5 + Math.random() * 0.4));

      return {
        studentId: enrollment.studentId,
        nom: user?.name?.split(" ").slice(-1)[0] ?? user?.name ?? "Nom",
        studentSurname: user?.prenom ?? "",
        studentusername: user?.username ?? "",
        studentSexe: user?.sexe ?? "",
        score,
        maxScore: spec.maxScore,
      };
    });

    const existing = await Prisma.fiche.findFirst({
      where: {
        branchId,
        lessonId: teaching.id,
        classSectionId: teaching.classeId,
        periodId: period.id,
        anneeId: currentYear.id,
        typeFiche: spec.typeFiche,
      },
    });

    const payload = {
      classeName: teaching.classe.nameClasse,
      classSectionId: teaching.classeId!,
      lessonId: teaching.id,
      coursName: teaching.cours.nameCours,
      periodeName: period.label,
      periodId: period.id,
      anneeId: currentYear.id,
      anneeName: currentYear.nameYear,
      teacherId: teaching.teacherId!,
      typeFiche: spec.typeFiche,
      status: true,
      notes: JSON.stringify(notes),
      autres: JSON.stringify({}),
      dateUpdated: new Date(),
      branchId,
    };

    if (existing) {
      await Prisma.fiche.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      await Prisma.fiche.create({
        data: {
          id: randomUUID(),
          dateCreated: new Date(),
          ...payload,
        },
      });
      createdCount++;
    }
  }

  console.log(`OK ${createdCount} fiches de notes (rapports)`);
}

export async function clearReportFiches() {
  console.log("Suppression des fiches de notes de seed...");
  await Prisma.fiche.deleteMany({});
  console.log("OK fiches supprimées");
}
