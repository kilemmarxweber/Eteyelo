import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import FicheSaisieClient from "./FicheSaisieClient";
import NotesReadClient from "./NotesReadClient";
import { notFound } from "next/navigation";
import { ORG_ROLE } from "@/lib/permissions";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import {
  enforceNotesAreaAccess,
  isCursusSelfScopedRole,
  listAccessibleCursusStudents,
  resolveScopedCursusStudent,
} from "@/lib/auth/cursus-scope";
import { isUniversiteBranch } from "@/lib/branch-capabilities";
import {
  getCoursePonderationMap,
  resolveCoursePonderation,
} from "@/lib/course-ponderation";
import { UNIVERSITY_NOTES_LABELS } from "@/lib/university-lmd-labels";
import { getPeopleLabels } from "@/lib/people-labels";
import { buildStudentNotesReadData } from "@/lib/student-notes-read";

export const dynamic = "force-dynamic";

type LessonType = {
  id: string;
  classId: string;
  className: string;
  codeclasse: string;
  classCycle?: string | null;
  subjectId: string;
  subjectName: string;
  maxScore: number;

  fiches: {
    id: string;
    status: boolean;
    periodId: number;
    periodeName: string;
    typeFiche: string;
    anneeId: string;
    dateCreated: string;
  }[];
};

type TeacherType = {
  id: string;
  name: string;
  lessons: LessonType[];
};

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    studentId?: string;
    teacherId?: string;
    classId?: string;
  }>;
}) {
  const { session, userId, branchId, organizationId, typebranch } =
    await requireBranchContext();
  const role = enforceNotesAreaAccess(session);
  const sp = await searchParams;

  if (isCursusSelfScopedRole(role)) {
    const children = await listAccessibleCursusStudents({
      role,
      userId,
      branchId,
    });
    const scoped = await resolveScopedCursusStudent({
      role,
      userId,
      branchId,
      requestedStudentId: sp.studentId,
    });
    const peopleLabels = getPeopleLabels(typebranch);
    const classLabel = [scoped.className, scoped.classCode]
      .filter(Boolean)
      .join(" · ");

    const data = await buildStudentNotesReadData({
      studentId: scoped.id,
      studentName: scoped.fullName,
      classId: scoped.classId,
      classLabel: classLabel || null,
      branchId,
      schoolYearId: scoped.schoolYearId,
    });

    return (
      <Suspense fallback={null}>
        <NotesReadClient
          role={role}
          studentLabel={peopleLabels.student}
          childrenOptions={children}
          data={data}
          resultsHref={`/admin/organizations/${organizationId}/branches/${branchId}/results`}
        />
      </Suspense>
    );
  }

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
              periodeName: true,
              typeFiche: true,
              anneeId: true,
              dateCreated: true,
            },
            orderBy: { dateCreated: "asc" },
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
        cycle: true,
        level: true,
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
          level: classe?.level,
        };
      }),
    ),
  });

  const undefinedClassLabel = isUniversiteBranch(typebranch)
    ? UNIVERSITY_NOTES_LABELS.auditoireUndefined
    : "Classe non définie";

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

        className: classe?.nameClasse || undefinedClassLabel,

        codeclasse: classe?.codeClasse || "N/A",

        classCycle: classe?.cycle ?? null,

        subjectId: teaching?.coursId || "N/A",

        subjectName: cours?.nameCours || "Cours non defini",

        maxScore:
          resolveCoursePonderation(ponderationMap, {
            coursId: teaching.coursId,
            optionId: classe?.optionId,
            level: classe?.level,
          }) * 10,

        fiches:
          teaching.fiche?.map((f) => ({
            id: f.id,
            status: f.status,
            periodId: f.periodId,
            periodeName: f.periodeName,
            typeFiche: f.typeFiche,
            anneeId: f.anneeId,
            dateCreated: f.dateCreated.toISOString(),
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
          className: classe?.nameClasse || undefinedClassLabel,
          codeclasse: classe?.codeClasse || "N/A",
          classCycle: classe?.cycle ?? null,
          subjectId: teaching.coursId || "N/A",
          subjectName: cours?.nameCours || "Cours non défini",
          maxScore:
            resolveCoursePonderation(ponderationMap, {
              coursId: teaching.coursId,
              optionId: classe?.optionId,
              level: classe?.level,
            }) * 10,
          fiches: teaching.fiche.map((f) => ({
            id: f.id,
            status: f.status,
            periodId: f.periodId,
            periodeName: f.periodeName,
            typeFiche: f.typeFiche,
            anneeId: f.anneeId,
            dateCreated: f.dateCreated.toISOString(),
          })),
        };
      }),
    }))
    // Fiche : uniquement les enseignants ayant au moins un cours affecté
    .filter((t) => t.lessons.length > 0);

  return (
    <FicheSaisieClient
      isAdmin={canManage}
      teachers={teachers}
      typebranch={typebranch}
      initialTeacherId={sp.teacherId ?? null}
      initialClassId={sp.classId ?? null}
    />
  );
}
