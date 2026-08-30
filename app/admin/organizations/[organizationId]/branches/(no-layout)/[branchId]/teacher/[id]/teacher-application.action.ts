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
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { getTeacherAssignmentSnapshot, resolveDossierAvailability } from "@/lib/teacher-assignment-years";

const completeTeacherApplicationSchema = z.object({
  teacherId: z.string().min(1),
  desiredSubjects: z.string().trim().min(1, "Matières requises"),
  desiredLevels: z.string().trim().min(1, "Niveaux requis"),
  experienceSummary: z.string().trim().optional(),
  educationSummary: z.string().trim().optional(),
  skills: z.string().trim().optional(),
  motivation: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
  cvUrl: z.string().trim().min(1, "CV requis"),
  coverLetterUrl: z.string().trim().min(1, "Lettre de motivation requise"),
});

const replaceTeacherDocumentSchema = z.object({
  teacherId: z.string().min(1),
  document: z.enum(["cv", "coverLetter"]),
  url: z.string().trim().min(1, "Fichier requis"),
});

const updateTeacherIdentitySchema = z.object({
  teacherId: z.string().min(1),
  nom: z.string().trim().min(1, "Nom requis").max(120),
  postnom: z.string().trim().max(120),
  prenom: z.string().trim().max(120),
  sexe: z.enum(["M", "F"]),
  dateOfBirth: z.string().trim().optional().or(z.literal("")),
  telephone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.string().trim().email("Adresse email invalide")]),
  address: z.string().trim().max(300),
});

const teacherProfileDocumentSchema = z.object({
  teacherId: z.string().min(1),
  title: z.string().trim().min(1, "Le nom du document est requis.").max(160),
  url: z
    .string()
    .trim()
    .min(1, "Fichier requis.")
    .max(2000)
    .refine(
      (value) => value.split("?")[0]?.toLowerCase().endsWith(".pdf"),
      "Seuls les fichiers PDF sont acceptés.",
    ),
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

    const assignmentSnapshot = await getTeacherAssignmentSnapshot({
      teacherId: teacher.id,
      branchId,
    });
    const availability = resolveDossierAvailability({
      isUserActive: user.statusUser !== false,
      assignedToCurrentYear: assignmentSnapshot.assignedToCurrentYear,
    }).value;

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
        yearsOfExperience: assignmentSnapshot.count,
        experienceSummary: input.experienceSummary || null,
        educationSummary: input.educationSummary || null,
        skills: input.skills || null,
        availability,
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

/** Remplacement CV / lettre — propriétaire uniquement. */
export const replaceTeacherApplicationDocumentAction = action
  .input(replaceTeacherDocumentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();

    if (!isOrganizationOwnerSession(session)) {
      throw new Error(
        "Seul le propriétaire peut modifier les documents du dossier.",
      );
    }

    const application = await prisma.jobApplication.findFirst({
      where: {
        branchId,
        organizationId,
        applicationType: "TEACHER",
        teacherId: input.teacherId,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!application) {
      throw new Error("Dossier de candidature introuvable.");
    }

    await prisma.jobApplication.update({
      where: { id: application.id },
      data:
        input.document === "cv"
          ? { cvUrl: input.url }
          : { coverLetterUrl: input.url },
    });

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/teacher/${input.teacherId}`,
    );

    return { ok: true as const };
  });

/** Mise à jour réservée à l'identité de l'enseignant connecté. */
export const updateTeacherIdentityAction = action
  .input(updateTeacherIdentitySchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId, session } =
      await requireBranchContext();
    const canManage = canManageOrganization(session);
    const isTeacher = hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"]);

    if (!canManage && !isTeacher) {
      throw new Error("Vous ne pouvez pas modifier cette identité.");
    }

    const teacher = await prisma.teacher.findFirst({
      where: {
        id: input.teacherId,
        branchMember: {
          branchId,
          member: {
            organizationId,
            ...(canManage ? {} : { userId }),
          },
        },
      },
      select: {
        branchMember: { select: { member: { select: { userId: true } } } },
      },
    });

    const linkedUserId = teacher?.branchMember?.member?.userId;
    if (!linkedUserId) {
      throw new Error("Enseignant introuvable dans cette branche.");
    }

    const dateOfBirth = input.dateOfBirth
      ? new Date(input.dateOfBirth)
      : null;
    if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) {
      throw new Error("Date de naissance invalide.");
    }

    await prisma.user.update({
      where: { id: linkedUserId },
      data: {
        name: input.nom,
        postnom: input.postnom,
        prenom: input.prenom,
        sexe: input.sexe,
        dateOfBirth,
        telephone: input.telephone || null,
        email: input.email.trim().toLowerCase() || null,
        address: input.address || null,
      },
    });

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/teacher/${input.teacherId}`,
    );

    return { ok: true as const, message: "Identité mise à jour avec succès." };
  });

/** Ajout d'une pièce complémentaire par l'enseignant lui-même ou un gestionnaire. */
export const addTeacherProfileDocumentAction = action
  .input(teacherProfileDocumentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId, session } =
      await requireBranchContext();
    const canManage = canManageOrganization(session);
    const isTeacher = hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"]);

    const teacher = await prisma.teacher.findFirst({
      where: {
        id: input.teacherId,
        branchMember: {
          branchId,
          member: {
            organizationId,
            ...(canManage ? {} : { userId }),
          },
        },
      },
      select: { id: true },
    });

    if (!teacher || (!canManage && !isTeacher)) {
      throw new Error("Vous ne pouvez pas ajouter ce document.");
    }

    await prisma.teacherProfileDocument.create({
      data: {
        teacherId: teacher.id,
        branchId,
        title: input.title.trim(),
        url: input.url.trim(),
      },
    });

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/teacher/${input.teacherId}`,
    );

    return { ok: true as const, message: "Document ajouté avec succès." };
  });

const deleteTeacherProfileDocumentSchema = z.object({
  documentId: z.string().min(1),
});

export const deleteTeacherProfileDocumentAction = action
  .input(deleteTeacherProfileDocumentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId, session } =
      await requireBranchContext();
    const canManage = canManageOrganization(session);
    const isTeacher = hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"]);

    const document = await prisma.teacherProfileDocument.findFirst({
      where: {
        id: input.documentId,
        branchId,
        teacher: {
          branchMember: {
            member: {
              organizationId,
              ...(canManage ? {} : { userId }),
            },
          },
        },
      },
      select: { id: true, teacherId: true },
    });

    if (!document || (!canManage && !isTeacher)) {
      throw new Error("Vous ne pouvez pas supprimer ce document.");
    }

    await prisma.teacherProfileDocument.delete({ where: { id: document.id } });
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/teacher/${document.teacherId}`,
    );

    return { ok: true as const, message: "Document supprimé." };
  });
