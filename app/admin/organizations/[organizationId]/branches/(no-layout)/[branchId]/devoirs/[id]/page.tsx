import { notFound } from "next/navigation";

import { listAccessibleCursusStudents } from "@/lib/auth/cursus-scope";
import { enforceOnlineAssignmentAccess } from "@/lib/online-assignments/access";
import { assignmentBranchWhere } from "@/lib/online-assignments/scope";
import { prisma } from "@/lib/prisma";

import { DevoirDetailClient } from "./devoir-detail-client";

export const dynamic = "force-dynamic";

export default async function DevoirDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string; id: string }>;
}) {
  const { organizationId, branchId, id } = await params;
  let access;
  try {
    access = await enforceOnlineAssignmentAccess();
  } catch {
    notFound();
  }
  if (access.branchId !== branchId) notFound();

  const row = await prisma.onlineAssignment.findFirst({
    where: { id, ...assignmentBranchWhere(branchId) },
    include: {
      classe: { select: { nameClasse: true } },
      cours: { select: { nameCours: true } },
      fiche: { select: { id: true, status: true, typeFiche: true } },
      questions: {
        orderBy: { position: "asc" },
        include: { options: { orderBy: { position: "asc" } } },
      },
      submissions: {
        include: {
          answers: true,
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
    },
  });
  if (!row) notFound();

  const baseAssignment = {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    startAt: row.startAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    totalPoints: row.totalPoints,
    resultsPublished: row.resultsPublished,
    shuffleOptions: row.shuffleOptions,
    className: row.classe.nameClasse,
    courseName: row.cours.nameCours,
    fiche: row.fiche,
    questions: row.questions.map((q) => ({
      id: q.id,
      type: q.type,
      position: q.position,
      statementHtml: q.statementHtml,
      points: q.points,
      correctAnswerJson: access.mode === "manage" ? q.correctAnswerJson : null,
      settingsJson: access.mode === "manage" ? q.settingsJson : null,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        isCorrect: access.mode === "manage" ? o.isCorrect : undefined,
      })),
    })),
  };

  if (access.mode === "manage") {
    return (
      <DevoirDetailClient
        mode="manage"
        organizationId={organizationId}
        branchId={branchId}
        assignment={baseAssignment}
        submissions={row.submissions.map((s) => ({
          id: s.id,
          studentName: [
            s.student.branchMember?.member?.user?.name,
            s.student.branchMember?.member?.user?.postnom,
            s.student.branchMember?.member?.user?.prenom,
          ]
            .filter(Boolean)
            .join(" "),
          status: s.status,
          provisionalScore: s.provisionalScore,
          finalScore: s.finalScore,
          answers: s.answers.map((a) => ({
            questionId: a.questionId,
            answerText: a.answerText,
            awardedPoints: a.awardedPoints,
            needsManual: a.needsManual,
          })),
        }))}
      />
    );
  }

  const students = await listAccessibleCursusStudents({
    role: access.role,
    userId: access.userId,
    branchId,
  });
  const allowed = new Set(students.map((s) => s.id));
  const inClass = students.some((s) => s.classId === row.classId);
  if (!inClass || row.status === "DRAFT") {
    notFound();
  }

  const visibleSubs = row.submissions.filter((s) => allowed.has(s.studentId));

  if (access.mode === "student") {
    const selfId = students[0]?.id;
    const mySub = visibleSubs.find((s) => s.studentId === selfId) ?? null;

    return (
      <DevoirDetailClient
        mode="student"
        organizationId={organizationId}
        branchId={branchId}
        assignment={baseAssignment}
        submission={
          mySub
            ? {
                id: mySub.id,
                status: mySub.status,
                provisionalScore: row.resultsPublished
                  ? mySub.provisionalScore
                  : null,
                finalScore: row.resultsPublished ? mySub.finalScore : null,
                answers: mySub.answers.map((a) => ({
                  questionId: a.questionId,
                  answerText: a.answerText,
                  answerJson: a.answerJson,
                  awardedPoints: row.resultsPublished ? a.awardedPoints : null,
                  needsManual: a.needsManual,
                  teacherFeedback: row.resultsPublished
                    ? a.teacherFeedback
                    : null,
                })),
              }
            : null
        }
      />
    );
  }

  // Parent : mêmes infos que l’élève, pour chaque enfant de la classe
  return (
    <DevoirDetailClient
      mode="parent"
      organizationId={organizationId}
      branchId={branchId}
      assignment={baseAssignment}
      submissions={students
        .filter((s) => s.classId === row.classId)
        .map((s) => {
          const sub = visibleSubs.find((x) => x.studentId === s.id);
          return {
            id: sub?.id ?? `pending-${s.id}`,
            studentName: s.fullName,
            status: sub?.status ?? "TODO",
            provisionalScore: row.resultsPublished
              ? (sub?.provisionalScore ?? null)
              : null,
            finalScore: row.resultsPublished ? (sub?.finalScore ?? null) : null,
            answers:
              sub?.answers.map((a) => ({
                questionId: a.questionId,
                answerText: a.answerText,
                awardedPoints: row.resultsPublished ? a.awardedPoints : null,
                needsManual: a.needsManual,
              })) ?? [],
          };
        })}
    />
  );
}
