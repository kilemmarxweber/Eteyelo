"use server";

import { z } from "zod";
import { requireBranchAreaContext } from "@/lib/auth/require-branch-context";
import { resolveGrantedCursusViewerRole } from "@/lib/auth/cursus-scope";
import { prisma } from "@/lib/prisma";
import {
  buildLocalizedSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { sendStudentResultsNotification } from "@/lib/email/send-student-results-notification";
import { action } from "@/lib/zsa";

export const getResultsReportContextAction = action.handler(async () => {
  const { branchId, organizationId } = await requireBranchAreaContext("results");

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: schoolReportBranchSelect,
  });

  if (!branch) throw new Error("Branche active introuvable");

  return buildLocalizedSchoolReportContext(branch);
});

const parentUserSelect = {
  id: true,
  email: true,
  telephone: true,
  prenom: true,
  name: true,
  postnom: true,
} as const;

function parentFullName(user: {
  prenom: string | null;
  name: string | null;
  postnom: string | null;
} | null) {
  if (!user) return "Parent";
  return (
    [user.prenom, user.name, user.postnom].filter(Boolean).join(" ").trim() ||
    "Parent"
  );
}

function studentFullName(user: {
  prenom: string | null;
  name: string | null;
  postnom: string | null;
} | null) {
  if (!user) return "Élève";
  return (
    [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim() ||
    "Élève"
  );
}

const sendResultsSchema = z.object({
  classIds: z.array(z.string().min(1)).min(1),
  periodNames: z.array(z.string().min(1)).min(1),
  yearName: z.string().min(1),
  studentId: z.string().min(1).optional(),
});

export const sendResultsToParentsAction = action
  .input(sendResultsSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } =
      await requireBranchAreaContext("results");
    const role = resolveGrantedCursusViewerRole(session);
    if (role === "student" || role === "parent") {
      throw new Error("Action réservée au personnel de l'établissement.");
    }

    const classIds = Array.from(new Set(input.classIds));
    const classes = await prisma.classe.findMany({
      where: { id: { in: classIds }, branchId },
      select: { id: true, nameClasse: true },
    });
    if (classes.length === 0) {
      throw new Error("Aucune classe valide pour cette branche.");
    }
    const allowedClassIds = classes.map((row) => row.id);
    const classNameById = new Map(classes.map((row) => [row.id, row.nameClasse]));

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: { name: true },
    });
    const schoolName = branch?.name?.trim() || "Établissement";

    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        branchId,
        classeId: { in: allowedClassIds },
        schoolYear: { isCurrentYear: true, branchId },
        ...(input.studentId ? { studentId: input.studentId } : {}),
      },
      select: {
        classeId: true,
        student: {
          select: {
            id: true,
            parent: {
              select: {
                branchMember: {
                  select: {
                    member: {
                      select: { user: { select: parentUserSelect } },
                    },
                  },
                },
              },
            },
            branchMember: {
              select: {
                member: {
                  select: { user: { select: parentUserSelect } },
                },
              },
            },
          },
        },
      },
    });

    if (enrollments.length === 0) {
      throw new Error("Aucun élève trouvé pour cette sélection.");
    }

    const fiches = await prisma.fiche.findMany({
      where: {
        branchId,
        typeFiche: "ficheCote",
        classSectionId: { in: allowedClassIds },
        anneeName: input.yearName,
        periodeName: { in: input.periodNames },
      },
      select: {
        id: true,
        notes: true,
        coursName: true,
        classSectionId: true,
      },
    });

    type Acc = {
      studentId: string;
      studentName: string;
      className: string;
      email: string | null;
      phone: string | null;
      parentName: string;
      lines: Map<string, { score: number; maxScore: number }>;
    };

    const byStudent = new Map<string, Acc>();
    for (const enrollment of enrollments) {
      const studentUser = enrollment.student.branchMember?.member?.user ?? null;
      const parentUser =
        enrollment.student.parent?.branchMember?.member?.user ?? null;
      byStudent.set(enrollment.student.id, {
        studentId: enrollment.student.id,
        studentName: studentFullName(studentUser),
        className: classNameById.get(enrollment.classeId) ?? "",
        email: parentUser?.email?.trim() || null,
        phone: parentUser?.telephone?.trim() || null,
        parentName: parentFullName(parentUser),
        lines: new Map(),
      });
    }

    for (const fiche of fiches) {
      let parsed: Array<{
        studentId?: string;
        score?: number;
        maxScore?: number;
      }> = [];
      try {
        parsed = fiche.notes ? JSON.parse(fiche.notes) : [];
      } catch {
        parsed = [];
      }
      const subject = fiche.coursName?.trim() || "Matière";
      for (const note of parsed) {
        if (!note.studentId) continue;
        const acc = byStudent.get(note.studentId);
        if (!acc) continue;
        const current = acc.lines.get(subject) ?? { score: 0, maxScore: 0 };
        current.score += Number(note.score) || 0;
        current.maxScore += Number(note.maxScore) || 0;
        acc.lines.set(subject, current);
      }
    }

    const periodLabel = input.periodNames.join(", ");
    let notified = 0;
    let skippedNoContact = 0;
    let skippedNoGrades = 0;
    let whatsappSent = 0;
    let whatsappError: string | undefined;
    let skipWhatsApp = false;

    for (const acc of byStudent.values()) {
      const lines = Array.from(acc.lines.entries()).map(([subject, value]) => ({
        subject,
        score: value.score,
        maxScore: value.maxScore,
      }));
      if (lines.length === 0) {
        skippedNoGrades += 1;
        continue;
      }
      if (!acc.email && !acc.phone) {
        skippedNoContact += 1;
        continue;
      }

      const totalScore = lines.reduce((sum, line) => sum + line.score, 0);
      const totalMax = lines.reduce((sum, line) => sum + line.maxScore, 0);
      const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

      const result = await sendStudentResultsNotification({
        to: acc.email,
        phone: skipWhatsApp ? null : acc.phone,
        parentName: acc.parentName,
        studentName: acc.studentName,
        schoolName,
        className: acc.className,
        periodLabel,
        yearLabel: input.yearName,
        lines,
        percentage,
        organizationId,
      });

      notified += 1;
      if (result.whatsappSent) whatsappSent += 1;
      if (!whatsappError && result.whatsappError) {
        whatsappError = result.whatsappError;
        if (result.whatsappError.includes("pas connecté")) {
          skipWhatsApp = true;
        }
      }
    }

    return {
      notified,
      whatsappSent,
      skippedNoContact,
      skippedNoGrades,
      whatsappError,
    };
  });
