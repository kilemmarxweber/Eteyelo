import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

const enrollmentData = [
  {
    schoolYear: "2025-2026",
    classe: "7E-GEN-A",
    studentUsernames: [
      "eleve.kasongo.junior",
      "eleve.kalombo.grace",
      "eleve.mukendi.sarah",
    ],
  },
  {
    schoolYear: "2025-2026",
    classe: "7E-GEN-B",
    studentUsernames: ["eleve.tshiamala.michel", "eleve.kabongo.ruth"],
  },
  {
    schoolYear: "2025-2026",
    classe: "5E-BIO-A",
    studentUsernames: ["eleve.mulumba.prince", "eleve.mwamba.esther"],
  },
  {
    schoolYear: "2025-2026",
    classe: "5E-MATH-A",
    studentUsernames: ["eleve.katanga.david", "eleve.mputu.samuel"],
  },
  {
    schoolYear: "2025-2026",
    classe: "5E-INFO-A",
    studentUsernames: ["eleve.tshilombo.joie"],
  },
  {
    schoolYear: "2023-2024",
    classe: "6E-BIO-A",
    studentUsernames: ["eleve.mulumba.prince", "eleve.mwamba.esther"],
  },
  {
    schoolYear: "2023-2024",
    classe: "6E-MATH-A",
    studentUsernames: ["eleve.katanga.david", "eleve.mputu.samuel"],
  },
];

function normalizeUsername(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function initClassEnrollments() {
  console.log("Initialisation des inscriptions de classe...");
  const branchId = await getSeedBranchId();

  const schoolYears = await Prisma.schoolYear.findMany({ where: { branchId } });
  const classes = await Prisma.classe.findMany({ where: { branchId } });
  const students = await Prisma.student.findMany({
    include: {
      branchMember: {
        include: {
          member: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  const schoolYearMap = new Map(schoolYears.map((sy) => [sy.nameYear, sy.id]));
  const classeMap = new Map(classes.map((c) => [c.codeClasse, c.id]));
  const studentMap = new Map(
    students.map((s) => [
      normalizeUsername(s.branchMember?.member?.user?.username),
      s.id,
    ]),
  );

  let createdCount = 0;

  for (const enrollment of enrollmentData) {
    const schoolYearId = schoolYearMap.get(enrollment.schoolYear);
    const classeId = classeMap.get(enrollment.classe);

    if (!schoolYearId) {
      console.warn(`Annee scolaire ${enrollment.schoolYear} non trouvee`);
      continue;
    }

    if (!classeId) {
      console.warn(`Classe ${enrollment.classe} non trouvee`);
      continue;
    }

    for (const studentUsername of enrollment.studentUsernames) {
      const studentId = studentMap.get(studentUsername);

      if (!studentId) {
        console.warn(`Etudiant ${studentUsername} non trouve`);
        continue;
      }

      const existingEnrollment = await Prisma.classEnrollment.findFirst({
        where: {
          schoolYearId,
          studentId,
        },
      });

      if (!existingEnrollment) {
        await Prisma.classEnrollment.create({
          data: {
            schoolYearId,
            classeId,
            studentId,
            statusEnrollment: true,
            branchId,
          },
        });
        createdCount++;
      } else if (existingEnrollment.branchId !== branchId) {
        await Prisma.classEnrollment.update({
          where: { id: existingEnrollment.id },
          data: { branchId, classeId },
        });
      }
    }
  }

  console.log(`OK ${createdCount} inscriptions creees`);
}

export async function clearClassEnrollments() {
  console.log("Suppression des inscriptions...");
  await Prisma.classEnrollment.deleteMany({});
  console.log("OK inscriptions supprimees");
}
