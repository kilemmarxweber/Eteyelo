"use server";
import { prisma } from "@/lib/prisma";
import { getStudentsByClass as getStudentsByClassFromLib } from "@/lib/actions";
import { FicheTypes } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { ORG_ROLE } from "@/lib/permissions";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import {
  CreateFicheParams,
  CreateFicheResult,
  typeFichesDefault,
} from "./components/types";
import {
  getCoursePonderationMap,
  resolveCoursePonderation,
} from "@/lib/course-ponderation";

export async function getSchoolYear() {
  const { branchId } = await requireBranchContext();
  return await prisma.schoolYear.findFirst({
    where: { isCurrentYear: true, branchId },
  });
}
export async function getStudentsByClass(
  classId: string,
  schoolYearId?: string,
) {
  return getStudentsByClassFromLib(classId, schoolYearId);
}
// récupère toutes les périodes
export async function getPeriods() {
  const { branchId } = await requireBranchContext();
  const periods = await prisma.period.findMany({
    where: { branchId },
    orderBy: { startDate: "asc" },
  });

  return periods.map((p) => ({
    id: p.id,
    label: p.label,
  }));
}
export async function checkExistingFiche(params: {
  teacherId: string;
  classId: string;
  lessonId: string;
  periodId: number;
  anneeId: string;
  typeFiche: FicheTypes;
}) {
  try {
    const existing = await prisma.fiche.findFirst({
      where: {
        teacherId: params.teacherId,
        classSectionId: params.classId,
        lessonId: params.lessonId,
        periodId: params.periodId,
        anneeId: params.anneeId,
        typeFiche: params.typeFiche,
      },
    });

    if (existing) {
      return {
        exists: true,
        data: {
          notes: existing.notes ? JSON.parse(existing.notes) : [],
          autres: existing.autres
            ? JSON.parse(existing.autres)
            : typeFichesDefault,
        },
      };
    }

    return { exists: false };
  } catch (error) {
    console.error("Error checking existing fiche:", error);
    return { exists: false };
  }
}
export async function createFiche(
  data: CreateFicheParams,
): Promise<CreateFicheResult> {
  try {
    const { session, userId, branchId } = await requireBranchContext();
    const canManage = canManageOrganization(session);
    const isTeacher = hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"]);

    const annees = await prisma.schoolYear.findFirst({
      where: { isCurrentYear: true, branchId },
    });
    if (!annees?.id) {
      console.warn("⚠️ année manquante, fallback temporaire");
    }
    // ✅ Sécurité obligatoire
    if (!annees?.id) {
      throw new Error("Année scolaire introuvable");
    }

    // 🔐 AUTHORIZATION
    if (!canManage && !isTeacher) {
      if (!userId) {
        return {
          success: false,
          error: true,
          message:
            "Vous n'êtes pas autorisé à créer ou modifier une fiche pour cette classe.",
        };
      }

      const teacherRecord = await prisma.teacher.findFirst({
        where: {
          id: data.teacherId,
          branchMember: {
            branchId,
            member: {
              userId,
            },
          },
        },
      });

      if (!teacherRecord) {
        return {
          success: false,
          error: true,
          message:
            "Vous ne pouvez créer une fiche que pour une leçon qui vous est attribuée.",
        };
      }

      const lesson = await prisma.teaching.findFirst({
        where: {
          id: data.lessonId,
          teacherId: data.teacherId,
          classeId: data.classId,
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
      });

      if (
        !lesson ||
        lesson.teacherId !== data.teacherId ||
        lesson.classeId !== data.classId
      ) {
        return {
          success: false,
          error: true,
          message:
            "Vous ne pouvez créer une fiche que pour une leçon qui vous est attribuée.",
        };
      }
    }

    if (!canManage && isTeacher) {
      const teacherRecord = await prisma.teacher.findFirst({
        where: {
          id: data.teacherId,
          branchMember: {
            branchId,
            member: {
              userId,
            },
          },
        },
      });

      const lesson = await prisma.teaching.findFirst({
        where: {
          id: data.lessonId,
          teacherId: data.teacherId,
          classeId: data.classId,
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
      });

      if (!teacherRecord || !lesson) {
        return {
          success: false,
          error: true,
          message:
            "Vous ne pouvez creer une fiche que pour une lecon qui vous est attribuee.",
        };
      }
    }

    const isFicheCote = data.typeFiche === "ficheCote";

    // 🔎 Vérifie si fiche existe déjà
    const existing = isFicheCote
      ? await prisma.fiche.findFirst({
          where: {
            classSectionId: data.classId,
            lessonId: data.lessonId,
            periodId: data.periodId,
            anneeId: annees.id, // ✅ FIX
            teacherId: data.teacherId,
            typeFiche: data.typeFiche,
            branchId,
          },
        })
      : null;

    // 🔁 UPDATE
    // Compter les scores différents de 0

    // Vérifier s'il y en a au moins 2

    // Définir le status
    data.status = false;

    if (existing) {
      await prisma.fiche.update({
        where: { id: existing.id },
        data: {
          notes: JSON.stringify(data.notes),
          autres:
            JSON.stringify(data.autres) || JSON.stringify(typeFichesDefault),
          status: false,
          dateUpdated: new Date(),
        },
      });

      return { success: true };
    }

    // 🔧 Builder propre (100% Prisma safe)
    const buildFicheData = ({
      lessonId,
      coursName,
      teacherId,
      notes,
    }: {
      lessonId: string;
      coursName: string;
      teacherId: string;
      notes: any;
    }) => ({
      id: uuidv4(),
      classeName: data.className,
      classSectionId: data.classId,
      lessonId,
      coursName,
      periodeName: data.periodName,
      periodId: data.periodId,
      anneeId: annees.id,
      anneeName: annees.nameYear,
      teacherId,
      typeFiche: data.typeFiche,
      status: false,
      notes: JSON.stringify(notes),
      autres: JSON.stringify(data.autres) || JSON.stringify(typeFichesDefault),
      dateCreated: new Date(),
      dateUpdated: new Date(),
      branchId,
    });

    // 🔎 Vérifie fiches existantes pour la classe
    // 🆕 CAS ficheCote → créer toutes les fiches si aucune
    if (isFicheCote) {
      const existingClassFiches = await prisma.fiche.count({
        where: {
          classSectionId: data.classId,
          periodId: data.periodId,
          anneeId: annees.id,
          typeFiche: data.typeFiche,
          branchId,
        },
      });

      if (existingClassFiches === 0) {
        const lessons = await prisma.teaching.findMany({
          where: {
            classeId: data.classId,
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
          include: { cours: true, classe: true },
        });
        const ponderationMap = await getCoursePonderationMap({
          branchId,
          pairs: lessons.map((lesson) => ({
            coursId: lesson.coursId,
            optionId: lesson.classe?.optionId,
          })),
        });

        const fichesToCreate = lessons.map((lesson) =>
          buildFicheData({
            lessonId: lesson.id,
            coursName: lesson.cours?.nameCours || "",
            teacherId: lesson.teacherId || data.teacherId,
            notes:
              lesson.id === data.lessonId
                ? data.notes
                : data.notes.map((n) => ({
                    ...n,
                    score: 0,
                    maxScore:
                      resolveCoursePonderation(ponderationMap, {
                        coursId: lesson.coursId,
                        optionId: lesson.classe?.optionId,
                      }) * 10,
                  })),
          }),
        );

        await prisma.fiche.createMany({
          data: fichesToCreate,
        });
      } else {
        // fiche existe → créer UNE seule
        await prisma.fiche.create({
          data: buildFicheData({
            lessonId: data.lessonId,
            coursName: data.subjectName,
            teacherId: data.teacherId,
            notes: data.notes,
          }),
        });
      }
    } else {
      // 🆕 autres types → toujours UNE fiche
      await prisma.fiche.create({
        data: buildFicheData({
          lessonId: data.lessonId,
          coursName: data.subjectName,
          teacherId: data.teacherId,
          notes: data.notes,
        }),
      });
    }

    return { success: true };
  } catch (err) {
    console.error("Erreur lors de la création de la fiche :", err);
    return { success: false, error: true };
  }
}
