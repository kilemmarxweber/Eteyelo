import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

const teachingData = [
  {
    schoolYear: "2025-2026",
    teacherUsername: "prof.mukendi",
    cours: "MATH",
    classes: ["7E-GEN-A", "7E-GEN-B"],
    titulaire: true,
  },
  {
    schoolYear: "2025-2026",
    teacherUsername: "prof.mbuyi",
    cours: "FRAN",
    classes: ["7E-GEN-A", "7E-GEN-B", "5E-BIO-A"],
    titulaire: false,
  },
  {
    schoolYear: "2025-2026",
    teacherUsername: "prof.tshimanga",
    cours: "PHYS",
    classes: ["5E-MATH-A", "5E-BIO-A"],
    titulaire: true,
  },
  {
    schoolYear: "2025-2026",
    teacherUsername: "prof.ndaya",
    cours: "BIO",
    classes: ["5E-BIO-A", "6E-BIO-A"],
    titulaire: true,
  },
  {
    schoolYear: "2025-2026",
    teacherUsername: "prof.kabila",
    cours: "CHIM",
    classes: ["5E-BIO-A", "6E-BIO-A"],
    titulaire: false,
  },
  {
    schoolYear: "2025-2026",
    teacherUsername: "prof.mpiana",
    cours: "ANG",
    classes: ["7E-GEN-A", "7E-GEN-B", "5E-MATH-A", "5E-BIO-A"],
    titulaire: false,
  },
  {
    schoolYear: "2025-2026",
    teacherUsername: "prof.mukendi",
    cours: "PROG",
    classes: ["5E-INFO-A"],
    titulaire: false,
  },
  {
    schoolYear: "2025-2026",
    teacherUsername: "prof.tshimanga",
    cours: "INFO",
    classes: ["5E-INFO-A"],
    titulaire: true,
  },
  {
    schoolYear: "2023-2024",
    teacherUsername: "prof.ndaya",
    cours: "BIO",
    classes: ["6E-BIO-A"],
    titulaire: true,
  },
  {
    schoolYear: "2023-2024",
    teacherUsername: "prof.kabila",
    cours: "CHIM",
    classes: ["6E-BIO-A", "6E-MATH-A"],
    titulaire: false,
  },
  {
    schoolYear: "2023-2024",
    teacherUsername: "prof.tshimanga",
    cours: "PHYS",
    classes: ["6E-MATH-A"],
    titulaire: true,
  },
];

export async function initTeaching() {
  console.log("Initialisation des enseignements...");
  const branchId = await getSeedBranchId();

  const schoolYears = await Prisma.schoolYear.findMany({ where: { branchId } });
  const teachers = await Prisma.teacher.findMany({
    where: {
      branchMember: {
        branchId,
      },
    },
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
  const cours = await Prisma.cours.findMany({ where: { branchId } });
  const classes = await Prisma.classe.findMany({ where: { branchId } });

  const schoolYearMap = new Map(schoolYears.map((sy) => [sy.nameYear, sy.id]));
  const teacherMap = new Map(
    teachers.map((t) => [t.branchMember?.member?.user?.username, t.id]),
  );
  const coursMap = new Map(cours.map((c) => [c.codeCours, c.id]));
  const classeMap = new Map(classes.map((c) => [c.codeClasse, c.id]));

  let createdCount = 0;

  for (const teaching of teachingData) {
    const schoolYearId = schoolYearMap.get(teaching.schoolYear);
    const teacherId = teacherMap.get(teaching.teacherUsername);
    const coursId = coursMap.get(teaching.cours);

    if (!schoolYearId) {
      console.warn(`Annee scolaire ${teaching.schoolYear} non trouvee`);
      continue;
    }

    if (!teacherId) {
      console.warn(`Enseignant ${teaching.teacherUsername} non trouve`);
      continue;
    }

    if (!coursId) {
      console.warn(`Cours ${teaching.cours} non trouve`);
      continue;
    }

    for (const className of teaching.classes) {
      const classeId = classeMap.get(className);

      if (!classeId) {
        console.warn(`Classe ${className} non trouvee`);
        continue;
      }

      const isTitulaire =
        teaching.titulaire && teaching.classes.indexOf(className) === 0;

      const existingTeaching = await Prisma.teaching.findFirst({
        where: {
          classeId,
          schoolYearId,
          coursId,
        },
      });

      if (!existingTeaching) {
        await Prisma.teaching.create({
          data: {
            teacherId,
            classeId,
            schoolYearId,
            coursId,
            titulaire: isTitulaire,
            statusTeaching: true,
            branchId,
          },
        });
        createdCount++;
      } else {
        await Prisma.teaching.update({
          where: { id: existingTeaching.id },
          data: {
            teacherId,
            titulaire: isTitulaire,
            statusTeaching: true,
            branchId,
          },
        });
      }
    }
  }

  console.log(`OK ${createdCount} enseignements crees`);
}

export async function clearTeaching() {
  console.log("Suppression des enseignements...");
  await Prisma.teaching.deleteMany({});
  console.log("OK enseignements supprimes");
}
