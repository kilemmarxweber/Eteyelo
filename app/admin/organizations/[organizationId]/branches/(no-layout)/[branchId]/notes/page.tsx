import { prisma } from "@/lib/prisma";
import FicheSaisieClient from "./FicheSaisieClient";
import { notFound } from "next/navigation";
import { ORG_ROLE } from "@/lib/permissions";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import {
  getCoursePonderationMap,
  resolveCoursePonderation,
} from "@/lib/course-ponderation";

type LessonType = {
  id: string;
  classId: string;
  className: string;
  codeclasse: string;
  subjectId: string;
  subjectName: string;
  maxScore: number;

  fiches: {
    id: string;
    status: boolean;
    periodId: number;
    typeFiche: string;
    anneeId: string;
  }[];
};

type TeacherType = {
  id: string;
  name: string;
  lessons: LessonType[];
};

export default async function NotesPage() {
  const { session, userId, branchId } = await requireBranchContext();
  const canManage = canManageOrganization(session);
  const isTeacher = hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"]);

  if (!canManage && !isTeacher) {
    notFound();
  }

  const teacherWhere = canManage
    ? {
        branchMember: {
          branchId,
        },
      }
    : {
        branchMember: {
          branchId,
          member: {
            userId,
          },
        },
      };

  const currentSchoolYear = await prisma.schoolYear.findFirst({
    where: {
      branchId,
      isCurrentYear: true,
      isArchived: false,
    },
    select: { id: true },
  });

  const teachersFromDB = await prisma.teacher.findMany({
    where: teacherWhere,
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

      teaching: {
        where: {
          // Uniquement les cours encore affectés à l'enseignant
          OR: [{ statusTeaching: true }, { statusTeaching: null }],
          ...(currentSchoolYear
            ? { schoolYearId: currentSchoolYear.id }
            : {}),
          AND: [
            {
              OR: [
                { branchId },
                {
                  branchId: null,
                  classe: {
                    branchId,
                  },
                },
              ],
            },
          ],
        },
        include: {
          classe: true,

          cours: {
            select: {
              id: true,
              nameCours: true,
            },
          },

          fiche: {
            select: {
              id: true,
              status: true,
              periodId: true,
              typeFiche: true,
              anneeId: true,
            },
          },
        },
      },
    },
  });

  /* ===== IDS ===== */

  const coursIds = Array.from(
    new Set(
      teachersFromDB
        .flatMap((teacher) =>
          teacher.teaching.map((teaching) => teaching.coursId),
        )
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const classeIds = Array.from(
    new Set(
      teachersFromDB
        .flatMap((teacher) =>
          teacher.teaching.map((teaching) => teaching.classeId),
        )
        .filter((value): value is string => Boolean(value)),
    ),
  );

  /* ===== FETCH DATA ===== */

  const [coursList, classesList] = await Promise.all([
    prisma.cours.findMany({
      where: {
        branchId,
        id: {
          in: coursIds,
        },
      },

      select: {
        id: true,
        nameCours: true,
      },
    }),

    prisma.classe.findMany({
      where: {
        branchId,
        id: {
          in: classeIds,
        },
      },

      select: {
        id: true,
        codeClasse: true,
        nameClasse: true,
        optionId: true,
      },
    }),
  ]);

  /* ===== MAPS ===== */

  const coursMap = new Map(coursList.map((cours) => [cours.id, cours]));

  const classeMap = new Map(classesList.map((classe) => [classe.id, classe]));
  const ponderationMap = await getCoursePonderationMap({
    branchId,
    pairs: teachersFromDB.flatMap((teacher) =>
      teacher.teaching.map((teaching) => {
        const classe =
          classesList.find((item) => item.id === teaching.classeId) ||
          teaching.classe;

        return {
          coursId: teaching.coursId,
          optionId: classe?.optionId,
        };
      }),
    ),
  });

  const teacherMap = new Map<string, TeacherType>();

  /* ===== BUILD TEACHERS ===== */

  for (const teacherFromDB of teachersFromDB) {
    if (!teacherMap.has(teacherFromDB.id)) {
      teacherMap.set(teacherFromDB.id, {
        id: teacherFromDB.id,
        name: teacherFromDB.branchMember?.member?.user?.name || "N/A",
        lessons: [],
      });
    }

    const teacher = teacherMap.get(teacherFromDB.id)!;

    for (const teaching of teacherFromDB.teaching) {
      const lessonExists = teacher.lessons.some(
        (lesson) => lesson.id === teaching.id,
      );

      if (lessonExists) continue;

      const cours =
        (teaching.coursId && coursMap.get(teaching.coursId)) || teaching.cours;

      const classe =
        (teaching.classeId && classeMap.get(teaching.classeId)) ||
        teaching.classe;

      teacher.lessons.push({
        id: teaching.id,

        classId: teaching?.classeId || "N/A",

        className: classe?.nameClasse || "Classe non definie",

        codeclasse: classe?.codeClasse || "N/A",

        subjectId: teaching?.coursId || "N/A",

        subjectName: cours?.nameCours || "Cours non defini",

        maxScore:
          resolveCoursePonderation(ponderationMap, {
            coursId: teaching.coursId,
            optionId: classe?.optionId,
          }) * 10,

        fiches:
          teaching.fiche?.map((f) => ({
            id: f.id,
            status: f.status,
            periodId: f.periodId,
            typeFiche: f.typeFiche,
            anneeId: f.anneeId,
          })) || [],
      });
    }
  }

  const teachers: TeacherType[] = teachersFromDB
    .map((t) => ({
      id: t.id,
      name: t.branchMember?.member?.user?.name || "N/A",
      lessons: t.teaching.map((teaching) => {
        const cours = coursMap.get(teaching.coursId);
        const classe = classeMap.get(teaching.classeId);

        return {
          id: teaching.id,
          classId: teaching.classeId || "N/A",
          className: classe?.nameClasse || "Classe non définie",
          codeclasse: classe?.codeClasse || "N/A",
          subjectId: teaching.coursId || "N/A",
          subjectName: cours?.nameCours || "Cours non défini",
          maxScore:
            resolveCoursePonderation(ponderationMap, {
              coursId: teaching.coursId,
              optionId: classe?.optionId,
            }) * 10,
          fiches: teaching.fiche.map((f) => ({
            id: f.id,
            status: f.status,
            periodId: f.periodId,
            typeFiche: f.typeFiche,
            anneeId: f.anneeId,
          })),
        };
      }),
    }))
    // Fiche : uniquement les enseignants ayant au moins un cours affecté
    .filter((t) => t.lessons.length > 0);

  return <FicheSaisieClient isAdmin={canManage} teachers={teachers} />;
}
