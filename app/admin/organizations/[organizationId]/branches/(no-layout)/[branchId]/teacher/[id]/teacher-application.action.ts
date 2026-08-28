"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { action } from "@/lib/zsa";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canAccessPedagogyArea,
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { countTeacherClassAssignmentYears } from "@/lib/teacher-assignment-years";

const completeTeacherApplicationSchema = z.object({
  teacherId: z.string().min(1),
  desiredSubjects: z.string().trim().min(1, "Matières requises"),
  desiredLevels: z.string().trim().min(1, "Niveaux requis"),
  experienceSummary: z.string().trim().optional(),
  educationSummary: z.string().trim().optional(),
  skills: z.string().trim().optional(),
  availability: z.string().trim().optional(),
  motivation: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
  cvUrl: z.string().trim().min(1, "CV requis"),
  coverLetterUrl: z.string().trim().min(1, "Lettre de motivation requise"),
});

function createDossierReference() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `CAN-${stamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeSexe(value: string | null | undefined) {
  const normalized = (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.startsWith("f")) return "feminin";
  return "masculin";
}

export const completeTeacherApplicationAction = action
  .input(completeTeacherApplicationSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId, session } =
      await requireBranchContext();

    const teacher = await prisma.teacher.findFirst({
      where: {
        id: input.teacherId,
        branchMember: {
          branchId,
          member: { organizationId },
        },
      },
      include: {
        branchMember: {
          include: {
            member: { include: { user: true } },
          },
        },
      },
    });

    if (!teacher) {
      throw new Error("Enseignant introuvable.");
    }

    const isSelf = teacher.branchMember?.member?.userId === userId;
    const canWrite =
      canManageOrganization(session) ||
      canAccessPedagogyArea(session) ||
      (hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"]) && isSelf);

    if (!canWrite) {
      throw new Error("Vous ne pouvez pas compléter ce dossier.");
    }

    const user = teacher.branchMember?.member?.user;
    if (!user) {
      throw new Error("Compte utilisateur introuvable.");
    }

    const email = user.email?.trim().toLowerCase();
    if (!email) {
      throw new Error("Ajoutez d'abord un email sur le profil de l'enseignant.");
    }

    const existing = await prisma.jobApplication.findFirst({
      where: {
        branchId,
        organizationId,
        applicationType: "TEACHER",
        OR: [
          { teacherId: teacher.id },
          {
            email,
            status: { in: ["PENDING", "REVIEWED", "ACCEPTED", "HIRED"] },
          },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Un dossier de candidature existe déjà pour cet enseignant.");
    }

    const dateOfBirth = user.dateOfBirth
      ? user.dateOfBirth
      : input.dateOfBirth
        ? new Date(input.dateOfBirth)
        : null;

    if (!dateOfBirth || Number.isNaN(dateOfBirth.getTime())) {
      throw new Error("Indiquez la date de naissance pour compléter le dossier.");
    }

    const { count: assignmentYears } = await countTeacherClassAssignmentYears({
      teacherId: teacher.id,
      branchId,
    });

    const application = await prisma.jobApplication.create({
      data: {
        reference: createDossierReference(),
        branchId,
        organizationId,
        applicationType: "TEACHER",
        status: "HIRED",
        nom: user.name?.trim() || "Enseignant",
        postnom: user.postnom?.trim() || "—",
        prenom: user.prenom?.trim() || "—",
        sexe: normalizeSexe(user.sexe),
        dateOfBirth,
        telephone: user.telephone?.trim() || "non renseigné",
        email,
        address: user.address?.trim() || "—",
        photoUrl: user.image || null,
        desiredSubjects: input.desiredSubjects,
        desiredLevels: input.desiredLevels,
        yearsOfExperience: assignmentYears,
        experienceSummary: input.experienceSummary || null,
        educationSummary: input.educationSummary || null,
        skills: input.skills || null,
        availability: input.availability || null,
        motivation: input.motivation || null,
        cvUrl: input.cvUrl,
        coverLetterUrl: input.coverLetterUrl,
        consentAccepted: true,
        hiredById: userId,
        hiredAt: new Date(),
        teacherId: teacher.id,
      },
      select: { id: true, reference: true },
    });

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/teacher/${teacher.id}`,
    );

    return { ok: true as const, reference: application.reference };
  });
