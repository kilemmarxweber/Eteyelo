import { randomUUID } from "crypto";

import { typeFichesDefault } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/notes/components/types";
import { assertAssignmentBranchId } from "@/lib/online-assignments/scope";
import { prisma } from "@/lib/prisma";

const FICHE_MAX = 10;

/**
 * Crée ou met à jour la fiche liée (status false, type Devoir|Evaluation).
 * Plusieurs fiches du même type dans la période sont OK ;
 * une seule fiche par onlineAssignmentId.
 */
export async function syncFicheFromOnlineAssignment(assignmentId: string) {
  const assignment = await prisma.onlineAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      classe: { select: { id: true, nameClasse: true } },
      cours: { select: { id: true, nameCours: true } },
      fiche: { select: { id: true } },
      submissions: {
        where: { status: { in: ["SUBMITTED", "GRADED"] } },
        include: {
          student: {
            include: {
              branchMember: {
                include: {
                  member: {
                    select: {
                      user: {
                        select: {
                          name: true,
                          postnom: true,
                          prenom: true,
                          sexe: true,
                          username: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Devoir introuvable.");
  }

  const branchId = assertAssignmentBranchId(assignment.branchId);

  const schoolYear = await prisma.schoolYear.findFirst({
    where: { id: assignment.schoolYearId, branchId },
  });
  if (!schoolYear) throw new Error("Année scolaire introuvable.");

  const period = await prisma.period.findFirst({
    where: { id: assignment.periodId, branchId },
  });
  if (!period) throw new Error("Période introuvable.");

  const typeFiche =
    assignment.type === "EVALUATION" ? "Evaluation" : "Devoir";

  const totalPoints = assignment.totalPoints || 0;
  const notes = assignment.submissions.map((sub) => {
    const user = sub.student.branchMember?.member?.user;
    const raw =
      sub.finalScore ??
      sub.provisionalScore ??
      0;
    const scoreOn10 =
      totalPoints > 0
        ? Math.round((Number(raw) / totalPoints) * FICHE_MAX * 100) / 100
        : 0;
    return {
      studentId: sub.studentId,
      nom: user?.name ?? "",
      studentSurname: user?.postnom ?? "",
      studentusername: user?.username ?? user?.prenom ?? "",
      studentSexe: user?.sexe ?? "",
      score: scoreOn10,
      maxScore: FICHE_MAX,
      comment: `Devoir en ligne: ${assignment.title}`,
    };
  });

  const autres = JSON.stringify(typeFichesDefault);

  if (assignment.fiche?.id) {
    await prisma.fiche.update({
      where: { id: assignment.fiche.id },
      data: {
        notes: JSON.stringify(notes),
        autres,
        status: false,
        dateUpdated: new Date(),
        typeFiche,
      },
    });
    return assignment.fiche.id;
  }

  // Re-link via onlineAssignmentId if fiche exists from previous sync
  const existingByLink = await prisma.fiche.findFirst({
    where: { onlineAssignmentId: assignment.id, branchId },
    select: { id: true },
  });
  if (existingByLink) {
    await prisma.fiche.update({
      where: { id: existingByLink.id },
      data: {
        notes: JSON.stringify(notes),
        autres,
        status: false,
        dateUpdated: new Date(),
        typeFiche,
      },
    });
    return existingByLink.id;
  }

  const ficheId = randomUUID();
  await prisma.fiche.create({
    data: {
      id: ficheId,
      classeName: assignment.classe.nameClasse,
      classSectionId: assignment.classId,
      lessonId: assignment.teachingId,
      coursName: assignment.cours.nameCours,
      periodeName: period.label,
      periodId: assignment.periodId,
      anneeId: schoolYear.id,
      anneeName: schoolYear.nameYear,
      teacherId: assignment.teacherId,
      typeFiche,
      status: false,
      notes: JSON.stringify(notes),
      autres,
      dateCreated: new Date(),
      dateUpdated: new Date(),
      branchId,
      onlineAssignmentId: assignment.id,
    },
  });

  return ficheId;
}
