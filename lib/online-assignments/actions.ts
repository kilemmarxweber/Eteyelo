"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/prisma/generated/prisma/client";

import {
  enforceOnlineAssignmentAccess,
  enforceOnlineAssignmentManage,
  getAccessibleStudentsForOnline,
  resolveTeacherIdForUser,
} from "@/lib/online-assignments/access";
import { syncFicheFromOnlineAssignment } from "@/lib/online-assignments/fiche-bridge";
import { getFridayWeekendWindow, toActivityDateOnly } from "@/lib/online-assignments/friday-dates";
import {
  assignmentIdSchema,
  createAssignmentSchema,
  gradeAnswerSchema,
  publishResultsSchema,
  saveAnswersSchema,
  updateAssignmentSchema,
} from "@/lib/online-assignments/schemas";
import { scoreAutoQuestion, sumScores } from "@/lib/online-assignments/scoring";
import {
  assertAssignmentBranchId,
  assignmentBranchWhere,
} from "@/lib/online-assignments/scope";
import { prisma } from "@/lib/prisma";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { action } from "@/lib/zsa";
import { z } from "zod";

function revalidateDevoirs(organizationId: string, branchId: string, id?: string) {
  const scopedBranchId = assertAssignmentBranchId(branchId);
  const base = `/admin/organizations/${organizationId}/branches/${scopedBranchId}/devoirs`;
  revalidatePath(base);
  if (id) revalidatePath(`${base}/${id}`);
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function assertDayUniqueness(params: {
  branchId: string;
  classId: string;
  courseId: string;
  type: "DEVOIR" | "EVALUATION";
  activityDate: Date;
  excludeId?: string;
}) {
  const day = toActivityDateOnly(params.activityDate);
  const clash = await prisma.onlineAssignment.findFirst({
    where: {
      ...assignmentBranchWhere(params.branchId),
      classId: params.classId,
      courseId: params.courseId,
      type: params.type,
      activityDate: day,
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    select: { id: true, title: true },
  });
  if (clash) {
    throw new Error(
      `Un ${params.type === "DEVOIR" ? "devoir" : "évaluation"} existe déjà ce jour pour ce cours et cette classe (« ${clash.title} »).`,
    );
  }
  return day;
}

async function replaceQuestions(
  assignmentId: string,
  questions: z.infer<typeof createAssignmentSchema>["questions"],
) {
  await prisma.onlineQuestionOption.deleteMany({
    where: { question: { assignmentId } },
  });
  await prisma.onlineQuestion.deleteMany({ where: { assignmentId } });

  let total = 0;
  for (const [index, q] of questions.entries()) {
    total += Number(q.points) || 0;
    const created = await prisma.onlineQuestion.create({
      data: {
        assignmentId,
        type: q.type,
        position: q.position ?? index,
        statementHtml: q.statementHtml,
        points: q.points,
        settingsJson: (q.settingsJson ?? undefined) as Prisma.InputJsonValue | undefined,
        correctAnswerJson: (q.correctAnswerJson ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    const options =
      q.type === "TRUE_FALSE"
        ? [
            { label: "Vrai", isCorrect: Boolean((q.correctAnswerJson as { value?: boolean })?.value === true), position: 0 },
            { label: "Faux", isCorrect: Boolean((q.correctAnswerJson as { value?: boolean })?.value === false), position: 1 },
          ]
        : (q.options ?? []).map((opt, i) => ({
            label: opt.label,
            isCorrect: opt.isCorrect,
            position: opt.position ?? i,
          }));

    if (options.length) {
      await prisma.onlineQuestionOption.createMany({
        data: options.map((opt) => ({
          questionId: created.id,
          label: opt.label,
          isCorrect: opt.isCorrect,
          position: opt.position,
        })),
      });
    }
  }

  await prisma.onlineAssignment.update({
    where: { id: assignmentId },
    data: { totalPoints: total },
  });
}

export const getFridayPresetAction = action.handler(async () => {
  await enforceOnlineAssignmentManage();
  return getFridayWeekendWindow();
});

export const listAssignmentsAction = action.handler(async () => {
  const access = await enforceOnlineAssignmentAccess();

  if (access.mode === "manage") {
    const isAdmin = canManageOrganization(access.session);
    const teacherId = isAdmin
      ? null
      : await resolveTeacherIdForUser(
          access.userId,
          access.branchId,
          access.teacherId,
        );

    const rows = await prisma.onlineAssignment.findMany({
      where: {
        ...assignmentBranchWhere(access.branchId),
        ...(teacherId ? { teacherId } : {}),
      },
      orderBy: [{ dueAt: "desc" }, { createdAt: "desc" }],
      include: {
        classe: { select: { nameClasse: true } },
        cours: { select: { nameCours: true } },
        _count: { select: { submissions: true, questions: true } },
      },
    });
    return { mode: "manage" as const, assignments: rows };
  }

  const students = await getAccessibleStudentsForOnline(access);
  const classIds = [
    ...new Set(students.map((s) => s.classId).filter(Boolean) as string[]),
  ];

  const rows = await prisma.onlineAssignment.findMany({
    where: {
      ...assignmentBranchWhere(access.branchId),
      status: { in: ["PUBLISHED", "CLOSED"] },
      classId: { in: classIds.length ? classIds : ["__none__"] },
    },
    orderBy: [{ dueAt: "asc" }],
    include: {
      classe: { select: { nameClasse: true } },
      cours: { select: { nameCours: true } },
      submissions: {
        where: { studentId: { in: students.map((s) => s.id) } },
        select: {
          id: true,
          studentId: true,
          status: true,
          provisionalScore: true,
          finalScore: true,
          submittedAt: true,
        },
      },
      _count: { select: { questions: true } },
    },
  });

  return {
    mode: access.mode === "parent" ? ("parent" as const) : ("student" as const),
    students,
    assignments: rows,
    resultsVisible: true,
  };
});

export const getFormOptionsAction = action.handler(async () => {
  const access = await enforceOnlineAssignmentManage();
  const isAdmin = canManageOrganization(access.session);
  const teacherId = await resolveTeacherIdForUser(
    access.userId,
    access.branchId,
    access.teacherId,
  );

  const schoolYear = await prisma.schoolYear.findFirst({
    where: { branchId: access.branchId, isCurrentYear: true, isArchived: false },
  });
  if (!schoolYear) throw new Error("Aucune année scolaire active.");

  const teachings = await prisma.teaching.findMany({
    where: {
      schoolYearId: schoolYear.id,
      OR: [{ statusTeaching: true }, { statusTeaching: null }],
      AND: [
        {
          OR: [
            { branchId: access.branchId },
            { branchId: null, classe: { branchId: access.branchId } },
          ],
        },
      ],
      ...(!isAdmin && teacherId ? { teacherId } : {}),
    },
    include: {
      classe: { select: { id: true, nameClasse: true } },
      cours: { select: { id: true, nameCours: true } },
      teacher: {
        select: {
          id: true,
          branchMember: {
            select: {
              member: {
                select: { user: { select: { name: true, prenom: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { classe: { nameClasse: "asc" } },
  });

  const periods = await prisma.period.findMany({
    where: { branchId: access.branchId },
    orderBy: { id: "asc" },
    select: { id: true, label: true },
  });

  return {
    schoolYear: { id: schoolYear.id, nameYear: schoolYear.nameYear },
    teachings: teachings.map((t) => ({
      id: t.id,
      classId: t.classeId,
      className: t.classe?.nameClasse ?? "",
      courseId: t.coursId,
      courseName: t.cours?.nameCours ?? "",
      teacherId: t.teacherId,
      teacherName: [
        t.teacher?.branchMember?.member?.user?.name,
        t.teacher?.branchMember?.member?.user?.prenom,
      ]
        .filter(Boolean)
        .join(" "),
    })),
    periods,
    teacherId,
    friday: getFridayWeekendWindow(),
  };
});

export const createAssignmentAction = action
  .input(createAssignmentSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentManage();
    const activityDate = await assertDayUniqueness({
      branchId: access.branchId,
      classId: input.classId,
      courseId: input.courseId,
      type: input.type,
      activityDate: input.fridayPreset
        ? getFridayWeekendWindow().activityDate
        : input.activityDate,
    });

    const friday = input.fridayPreset ? getFridayWeekendWindow() : null;

    const created = await prisma.onlineAssignment.create({
      data: {
        branchId: assertAssignmentBranchId(access.branchId),
        schoolYearId: input.schoolYearId,
        classId: input.classId,
        courseId: input.courseId,
        teachingId: input.teachingId,
        teacherId: input.teacherId,
        periodId: input.periodId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        status: "DRAFT",
        startAt: friday?.startAt ?? input.startAt,
        dueAt: friday?.dueAt ?? input.dueAt,
        activityDate,
        shuffleOptions: input.shuffleOptions ?? false,
      },
    });

    if (input.questions?.length) {
      await replaceQuestions(created.id, input.questions);
    }

    revalidateDevoirs(access.organizationId, access.branchId, created.id);
    return { id: created.id };
  });

export const updateAssignmentAction = action
  .input(updateAssignmentSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentManage();
    const existing = await prisma.onlineAssignment.findFirst({
      where: { id: input.id, ...assignmentBranchWhere(access.branchId) },
    });
    if (!existing) throw new Error("Devoir introuvable.");
    if (existing.status !== "DRAFT") {
      throw new Error("Seuls les brouillons sont modifiables.");
    }

    const classId = input.classId ?? existing.classId;
    const courseId = input.courseId ?? existing.courseId;
    const type = input.type ?? existing.type;
    const activityDate = await assertDayUniqueness({
      branchId: access.branchId,
      classId,
      courseId,
      type,
      activityDate: input.activityDate ?? existing.activityDate,
      excludeId: existing.id,
    });

    await prisma.onlineAssignment.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description,
        type: input.type,
        classId: input.classId,
        courseId: input.courseId,
        teachingId: input.teachingId,
        teacherId: input.teacherId,
        periodId: input.periodId,
        schoolYearId: input.schoolYearId,
        startAt: input.startAt,
        dueAt: input.dueAt,
        activityDate,
        shuffleOptions: input.shuffleOptions,
      },
    });

    if (input.questions) {
      await replaceQuestions(existing.id, input.questions);
    }

    revalidateDevoirs(access.organizationId, access.branchId, existing.id);
    return { id: existing.id };
  });

export const publishAssignmentAction = action
  .input(assignmentIdSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentManage();
    const row = await prisma.onlineAssignment.findFirst({
      where: { id: input.id, ...assignmentBranchWhere(access.branchId) },
      include: { _count: { select: { questions: true } } },
    });
    if (!row) throw new Error("Devoir introuvable.");
    if (row._count.questions < 1) {
      throw new Error("Ajoutez au moins une question avant de publier.");
    }
    await assertDayUniqueness({
      branchId: access.branchId,
      classId: row.classId,
      courseId: row.courseId,
      type: row.type,
      activityDate: row.activityDate,
      excludeId: row.id,
    });
    await prisma.onlineAssignment.update({
      where: { id: row.id },
      data: { status: "PUBLISHED" },
    });
    revalidateDevoirs(access.organizationId, access.branchId, row.id);
    return { ok: true };
  });

export const closeAssignmentAction = action
  .input(assignmentIdSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentManage();
    await prisma.onlineAssignment.updateMany({
      where: { id: input.id, ...assignmentBranchWhere(access.branchId) },
      data: { status: "CLOSED" },
    });
    revalidateDevoirs(access.organizationId, access.branchId, input.id);
    return { ok: true };
  });

/**
 * Suppression autorisée uniquement pour :
 * - brouillon (DRAFT)
 * - devoir non encore corrigé (pas de résultats publiés, pas de copie GRADED, pas de fiche liée)
 */
export const deleteAssignmentAction = action
  .input(assignmentIdSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentManage();
    const row = await prisma.onlineAssignment.findFirst({
      where: { id: input.id, ...assignmentBranchWhere(access.branchId) },
      include: {
        fiche: { select: { id: true } },
        submissions: {
          where: { status: "GRADED" },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!row) throw new Error("Devoir introuvable.");

    const isDraft = row.status === "DRAFT";
    const isUncorrected =
      !row.resultsPublished && !row.fiche && row.submissions.length === 0;

    if (!isDraft && !isUncorrected) {
      throw new Error(
        "Suppression impossible : ce devoir a déjà été corrigé ou ses résultats sont publiés.",
      );
    }

    // Détache la fiche si jamais liée, puis supprime (cascade questions/soumissions)
    if (row.fiche?.id) {
      await prisma.fiche.update({
        where: { id: row.fiche.id },
        data: { onlineAssignmentId: null },
      });
    }

    await prisma.onlineAssignment.delete({
      where: { id: row.id },
    });

    revalidateDevoirs(access.organizationId, access.branchId);
    return { ok: true };
  });

export const duplicateAssignmentAction = action
  .input(assignmentIdSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentManage();
    const source = await prisma.onlineAssignment.findFirst({
      where: { id: input.id, ...assignmentBranchWhere(access.branchId) },
      include: {
        questions: { include: { options: true }, orderBy: { position: "asc" } },
      },
    });
    if (!source) throw new Error("Devoir introuvable.");

    const friday = getFridayWeekendWindow();
    // Cherche un vendredi libre en avançant semaine par semaine
    let activityDate = friday.activityDate;
    let startAt = friday.startAt;
    let dueAt = friday.dueAt;
    for (let week = 0; week < 12; week++) {
      const clash = await prisma.onlineAssignment.findFirst({
        where: {
          ...assignmentBranchWhere(access.branchId),
          classId: source.classId,
          courseId: source.courseId,
          type: source.type,
          activityDate,
        },
        select: { id: true },
      });
      if (!clash) break;
      activityDate = new Date(activityDate.getTime() + 7 * 24 * 3600_000);
      startAt = new Date(startAt.getTime() + 7 * 24 * 3600_000);
      dueAt = new Date(dueAt.getTime() + 7 * 24 * 3600_000);
    }

    const created = await prisma.onlineAssignment.create({
      data: {
        branchId: assertAssignmentBranchId(source.branchId),
        schoolYearId: source.schoolYearId,
        classId: source.classId,
        courseId: source.courseId,
        teachingId: source.teachingId,
        teacherId: source.teacherId,
        periodId: source.periodId,
        type: source.type,
        title: `${source.title} (copie)`,
        description: source.description,
        status: "DRAFT",
        startAt,
        dueAt,
        activityDate,
        shuffleOptions: source.shuffleOptions,
        totalPoints: source.totalPoints,
      },
    });

    for (const q of source.questions) {
      const nq = await prisma.onlineQuestion.create({
        data: {
          assignmentId: created.id,
          type: q.type,
          position: q.position,
          statementHtml: q.statementHtml,
          points: q.points,
          settingsJson: q.settingsJson ?? undefined,
          correctAnswerJson: q.correctAnswerJson ?? undefined,
        },
      });
      if (q.options.length) {
        await prisma.onlineQuestionOption.createMany({
          data: q.options.map((o) => ({
            questionId: nq.id,
            label: o.label,
            position: o.position,
            isCorrect: o.isCorrect,
          })),
        });
      }
    }

    revalidateDevoirs(access.organizationId, access.branchId, created.id);
    return { id: created.id };
  });

export const getAssignmentDetailAction = action
  .input(assignmentIdSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentAccess();
    const row = await prisma.onlineAssignment.findFirst({
      where: { id: input.id, ...assignmentBranchWhere(access.branchId) },
      include: {
        classe: { select: { nameClasse: true } },
        cours: { select: { nameCours: true } },
        questions: {
          orderBy: { position: "asc" },
          include: { options: { orderBy: { position: "asc" } } },
        },
        submissions: {
          include: {
            answers: true,
            files: true,
            student: {
              include: {
                branchMember: {
                  include: {
                    member: {
                      select: {
                        user: {
                          select: { name: true, postnom: true, prenom: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        fiche: { select: { id: true, status: true, typeFiche: true } },
      },
    });
    if (!row) throw new Error("Devoir introuvable.");

    if (access.mode === "manage") {
      return { mode: "manage" as const, assignment: row };
    }

    const students = await getAccessibleStudentsForOnline(access);
    const allowedIds = new Set(students.map((s) => s.id));
    const classOk = students.some((s) => s.classId === row.classId);
    if (!classOk || row.status === "DRAFT") throw new Error("Accès refusé.");

    const questions = row.questions.map((q) => {
      let options = q.options.map((o) => ({
        id: o.id,
        label: o.label,
        position: o.position,
        // hide isCorrect for students unless results published
        isCorrect: access.mode === "parent" ? undefined : undefined,
      }));
      if (row.shuffleOptions) options = shuffleArray(options);
      return {
        id: q.id,
        type: q.type,
        position: q.position,
        statementHtml: q.statementHtml,
        points: q.points,
        options,
      };
    });

    const mySubs = row.submissions.filter((s) => allowedIds.has(s.studentId));
    return {
      mode: access.mode as "student" | "parent",
      students,
      assignment: {
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.type,
        status: row.status,
        startAt: row.startAt,
        dueAt: row.dueAt,
        totalPoints: row.totalPoints,
        resultsPublished: row.resultsPublished,
        classe: row.classe,
        cours: row.cours,
        questions,
        submissions: mySubs.map((s) => ({
          id: s.id,
          studentId: s.studentId,
          status: s.status,
          provisionalScore: row.resultsPublished ? s.provisionalScore : null,
          finalScore: row.resultsPublished ? s.finalScore : null,
          submittedAt: s.submittedAt,
          answers: s.answers,
          studentName: [
            s.student.branchMember?.member?.user?.name,
            s.student.branchMember?.member?.user?.postnom,
            s.student.branchMember?.member?.user?.prenom,
          ]
            .filter(Boolean)
            .join(" "),
        })),
      },
    };
  });

export const saveAnswersAction = action
  .input(saveAnswersSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentAccess();
    if (access.mode !== "student") throw new Error("Réservé aux élèves.");

    const students = await getAccessibleStudentsForOnline(access);
    const student = students[0];
    if (!student) throw new Error("Profil élève introuvable.");

    const assignment = await prisma.onlineAssignment.findFirst({
      where: {
        id: input.assignmentId,
        ...assignmentBranchWhere(access.branchId),
        status: "PUBLISHED",
        classId: student.classId ?? undefined,
      },
      include: { questions: { include: { options: true } } },
    });
    if (!assignment) throw new Error("Devoir introuvable.");
    const now = new Date();
    if (now < assignment.startAt) throw new Error("Devoir pas encore ouvert.");
    if (now > assignment.dueAt) throw new Error("Date limite dépassée.");

    let submission = await prisma.onlineSubmission.findFirst({
      where: {
        assignmentId: assignment.id,
        studentId: student.id,
        attempt: 1,
      },
    });
    if (submission && submission.status !== "DRAFT") {
      throw new Error("Devoir déjà soumis.");
    }
    if (!submission) {
      submission = await prisma.onlineSubmission.create({
        data: {
          assignmentId: assignment.id,
          studentId: student.id,
          attempt: 1,
          status: "DRAFT",
        },
      });
    }

    for (const ans of input.answers) {
      await prisma.onlineAnswer.upsert({
        where: {
          submissionId_questionId: {
            submissionId: submission.id,
            questionId: ans.questionId,
          },
        },
        create: {
          submissionId: submission.id,
          questionId: ans.questionId,
          answerText: ans.answerText ?? null,
          answerJson: (ans.answerJson ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        update: {
          answerText: ans.answerText ?? null,
          answerJson: (ans.answerJson ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }

    revalidateDevoirs(access.organizationId, access.branchId, assignment.id);
    return { submissionId: submission.id };
  });

export const submitAssignmentAction = action
  .input(
    assignmentIdSchema.extend({
      answers: saveAnswersSchema.shape.answers.optional(),
    }),
  )
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentAccess();
    if (access.mode !== "student") throw new Error("Réservé aux élèves.");
    const students = await getAccessibleStudentsForOnline(access);
    const student = students[0];
    if (!student) throw new Error("Profil élève introuvable.");

    const assignment = await prisma.onlineAssignment.findFirst({
      where: { id: input.id, ...assignmentBranchWhere(access.branchId), status: "PUBLISHED" },
      include: { questions: { include: { options: true } } },
    });
    if (!assignment) throw new Error("Devoir introuvable.");
    if (new Date() > assignment.dueAt) throw new Error("Date limite dépassée.");
    if (new Date() < assignment.startAt) throw new Error("Devoir pas encore ouvert.");

    let submission = await prisma.onlineSubmission.findFirst({
      where: {
        assignmentId: assignment.id,
        studentId: student.id,
        attempt: 1,
      },
      include: { answers: true },
    });

    if (submission && submission.status !== "DRAFT") {
      throw new Error("Déjà soumis.");
    }

    if (!submission) {
      submission = await prisma.onlineSubmission.create({
        data: {
          assignmentId: assignment.id,
          studentId: student.id,
          attempt: 1,
          status: "DRAFT",
        },
        include: { answers: true },
      });
    }

    if (input.answers?.length) {
      for (const ans of input.answers) {
        await prisma.onlineAnswer.upsert({
          where: {
            submissionId_questionId: {
              submissionId: submission.id,
              questionId: ans.questionId,
            },
          },
          create: {
            submissionId: submission.id,
            questionId: ans.questionId,
            answerText: ans.answerText ?? null,
            answerJson: (ans.answerJson ??
              undefined) as Prisma.InputJsonValue | undefined,
          },
          update: {
            answerText: ans.answerText ?? null,
            answerJson: (ans.answerJson ??
              undefined) as Prisma.InputJsonValue | undefined,
          },
        });
      }
      submission = await prisma.onlineSubmission.findFirstOrThrow({
        where: { id: submission.id },
        include: { answers: true },
      });
    }

    if (!submission.answers.length) {
      throw new Error("Aucune réponse à soumettre.");
    }

    let provisional = 0;
    let pendingManual = 0;
    for (const q of assignment.questions) {
      const ans = submission.answers.find((a) => a.questionId === q.id);
      const scored = scoreAutoQuestion(
        {
          type: q.type,
          points: q.points,
          options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
          correctAnswerJson: q.correctAnswerJson,
          settingsJson: q.settingsJson,
        },
        {
          answerText: ans?.answerText,
          answerJson: ans?.answerJson,
        },
      );
      if (ans) {
        await prisma.onlineAnswer.update({
          where: { id: ans.id },
          data: {
            awardedPoints: scored.needsManual ? null : scored.awardedPoints,
            isCorrect: scored.needsManual ? null : scored.isCorrect,
            needsManual: scored.needsManual,
          },
        });
      }
      if (scored.needsManual) pendingManual += 1;
      else provisional += scored.awardedPoints;
    }

    await prisma.onlineSubmission.update({
      where: { id: submission.id },
      data: {
        status: pendingManual > 0 ? "SUBMITTED" : "GRADED",
        provisionalScore: provisional,
        finalScore: pendingManual > 0 ? null : provisional,
        submittedAt: new Date(),
        gradedAt: pendingManual > 0 ? null : new Date(),
      },
    });

    revalidateDevoirs(access.organizationId, access.branchId, assignment.id);
    return { provisionalScore: provisional, pendingManual };
  });

export const gradeAnswerAction = action
  .input(gradeAnswerSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentManage();
    const submission = await prisma.onlineSubmission.findFirst({
      where: {
        id: input.submissionId,
        assignment: assignmentBranchWhere(access.branchId),
      },
      include: { answers: true, assignment: { include: { questions: true } } },
    });
    if (!submission) throw new Error("Copie introuvable.");

    await prisma.onlineAnswer.update({
      where: {
        submissionId_questionId: {
          submissionId: submission.id,
          questionId: input.questionId,
        },
      },
      data: {
        awardedPoints: input.awardedPoints,
        needsManual: false,
        teacherFeedback: input.teacherFeedback ?? null,
        isCorrect: input.awardedPoints > 0,
      },
    });

    const refreshed = await prisma.onlineAnswer.findMany({
      where: { submissionId: submission.id },
    });
    const stillPending = refreshed.some((a) => a.needsManual);
    const total = sumScores(refreshed);

    await prisma.onlineSubmission.update({
      where: { id: submission.id },
      data: {
        provisionalScore: total,
        finalScore: stillPending ? null : total,
        status: stillPending ? "SUBMITTED" : "GRADED",
        gradedAt: stillPending ? null : new Date(),
      },
    });

    revalidateDevoirs(
      access.organizationId,
      access.branchId,
      submission.assignmentId,
    );
    return { ok: true, stillPending, total };
  });

export const publishResultsAction = action
  .input(publishResultsSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentManage();
    const row = await prisma.onlineAssignment.findFirst({
      where: { id: input.id, ...assignmentBranchWhere(access.branchId) },
      include: { submissions: { include: { answers: true } } },
    });
    if (!row) throw new Error("Devoir introuvable.");

    // Finalise scores
    for (const sub of row.submissions) {
      if (sub.status === "DRAFT") continue;
      const total = sumScores(sub.answers);
      await prisma.onlineSubmission.update({
        where: { id: sub.id },
        data: {
          provisionalScore: total,
          finalScore: total,
          status: "GRADED",
          gradedAt: sub.gradedAt ?? new Date(),
        },
      });
    }

    await prisma.onlineAssignment.update({
      where: { id: row.id },
      data: { resultsPublished: input.publish, status: "CLOSED" },
    });

    const ficheId = await syncFicheFromOnlineAssignment(row.id);

    revalidateDevoirs(access.organizationId, access.branchId, row.id);
    return { ok: true, ficheId };
  });

export const exportResultsCsvAction = action
  .input(assignmentIdSchema)
  .handler(async ({ input }) => {
    const access = await enforceOnlineAssignmentManage();
    const row = await prisma.onlineAssignment.findFirst({
      where: { id: input.id, ...assignmentBranchWhere(access.branchId) },
      include: {
        submissions: {
          include: {
            student: {
              include: {
                branchMember: {
                  include: {
                    member: {
                      select: {
                        user: { select: { name: true, postnom: true, prenom: true } },
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
    if (!row) throw new Error("Devoir introuvable.");

    const lines = [
      "eleve;statut;note_provisoire;note_finale;soumis_le",
      ...row.submissions.map((s) => {
        const u = s.student.branchMember?.member?.user;
        const name = [u?.name, u?.postnom, u?.prenom].filter(Boolean).join(" ");
        return [
          JSON.stringify(name),
          s.status,
          s.provisionalScore ?? "",
          s.finalScore ?? "",
          s.submittedAt?.toISOString() ?? "",
        ].join(";");
      }),
    ];
    return { csv: lines.join("\n"), filename: `devoir-${row.id}.csv` };
  });
