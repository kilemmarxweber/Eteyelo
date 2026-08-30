"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isCtebLevel } from "@/lib/class-structure";
import { getCtebLockDefaults } from "@/lib/class-catalog";
import { isAtelierBranch, isCentreFormationBranch } from "@/lib/branch-capabilities";
import { fetchPublishedBranchRegistrationInfo } from "@/lib/fetch-published-branch-registration-info";
import { getBranchManagerEmails } from "@/lib/email/get-branch-manager-emails";
import { sendBranchSubmissionNotificationEmail } from "@/lib/email/send-branch-submission-notification-email";
import { sendStudentRegistrationConfirmationEmail } from "@/lib/email/send-student-registration-confirmation-email";
import {
  familyExtraInfoSchema,
  studentExtraInfoSchema,
} from "@/lib/registration-extra-info";

const PRIMARY_MIN_AGE = 5;
const MAX_CHILDREN_PER_SUBMISSION = 8;

const guardianSchema = z.object({
  name: z.string().trim().min(2, "Nom du responsable requis"),
  postnom: z.string().trim().optional().or(z.literal("")),
  prenom: z.string().trim().optional().or(z.literal("")),
  relationship: z.string().trim().min(1, "Lien de parente requis"),
  sexe: z.enum(["masculin", "feminin"]),
  telephone: z.string().trim().min(7, "Telephone du responsable requis"),
  email: z.string().trim().email("Email du responsable invalide").optional().or(z.literal("")),
  address: z.string().trim().min(1, "Adresse du responsable requise"),
  isPrimary: z.boolean(),
});

const studentEntrySchema = z.object({
  name: z.string().trim().min(2, "Nom de l'eleve requis"),
  postnom: z.string().trim().optional().or(z.literal("")),
  prenom: z.string().trim().optional().or(z.literal("")),
  sexe: z.enum(["masculin", "feminin"]),
  dateOfBirth: z.string().min(1, "Date de naissance requise"),
  placeOfBirth: z.string().trim().min(2, "Lieu de naissance requis"),
  address: z.string().trim().min(1, "Adresse de l'eleve requise"),
  email: z.string().trim().email().optional().or(z.literal("")),
  provenanceEcole: z.string().trim().optional(),
  requestedLevel: z.string().trim().min(1, "Classe ou niveau souhaite requis"),
  requestedSection: z.string().trim().optional(),
  requestedOption: z.string().trim().optional(),
  requestedCycle: z.string().trim().optional(),
  photoUrl: z.string().trim().optional(),
  extra: studentExtraInfoSchema.optional(),
});

const onlineRegistrationBatchSchema = z.object({
  branchId: z.string().min(1, "Ecole requise"),
  students: z
    .array(studentEntrySchema)
    .min(1, "Au moins un eleve est requis")
    .max(
      MAX_CHILDREN_PER_SUBMISSION,
      `Maximum ${MAX_CHILDREN_PER_SUBMISSION} eleves par demande`,
    ),
  guardians: z.array(guardianSchema).max(2),
  familyExtra: familyExtraInfoSchema.optional(),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "Le consentement est obligatoire" }),
  }),
  termsInfoId: z.string().optional().nullable(),
});

/** @deprecated single-student shape kept for type compatibility during transition */
const onlineRegistrationSchema = z.object({
  branchId: z.string().min(1, "Ecole requise"),
  student: studentEntrySchema.omit({
    requestedLevel: true,
    requestedSection: true,
    requestedOption: true,
    photoUrl: true,
    extra: true,
  }).extend({
    provenanceEcole: z.string().trim().optional(),
  }),
  guardians: z.array(guardianSchema).max(2),
  requestedLevel: z.string().trim().min(1, "Classe ou niveau souhaite requis"),
  requestedSection: z.string().trim().optional(),
  requestedOption: z.string().trim().optional(),
  requestedCycle: z.string().trim().optional(),
  photoUrl: z.string().trim().optional(),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "Le consentement est obligatoire" }),
  }),
  termsInfoId: z.string().optional().nullable(),
});

export type OnlineRegistrationInput = z.infer<typeof onlineRegistrationSchema>;
export type OnlineRegistrationBatchInput = z.infer<
  typeof onlineRegistrationBatchSchema
>;

function ageFromDate(dateStr: string) {
  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export async function getActiveBranches() {
  return prisma.branch.findMany({
    where: {
      isActive: true,
      typebranch: { not: "ATELIER" },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      ville: true,
      pays: true,
      image: true,
      typebranch: true,
      cycles: {
        where: { isActive: true },
        select: { cycle: true, isActive: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export async function getPublishedBranchRegistrationInfo(branchId: string) {
  return fetchPublishedBranchRegistrationInfo(branchId);
}

export type PublicAcademicChoiceSection = {
  id: string;
  codeSection: string;
  nameSection: string;
  options: {
    id: string;
    codeOption: string;
    nameOption: string;
  }[];
};

export async function getPublicRegistrationAcademicChoices(branchId: string) {
  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      isActive: true,
      typebranch: { not: "ATELIER" },
    },
    select: { typebranch: true },
  });

  if (!branch || !["CENTRE_FORMATION", "UNIVERSITE"].includes(branch.typebranch)) {
    return null;
  }

  const [sections, options] = await Promise.all([
    prisma.section.findMany({
      where: { branchId, statusSection: true },
      orderBy: { nameSection: "asc" },
      select: { id: true, codeSection: true, nameSection: true },
    }),
    prisma.option.findMany({
      where: { branchId, statusOption: true },
      orderBy: { nameOption: "asc" },
      select: {
        id: true,
        codeOption: true,
        nameOption: true,
        sectionId: true,
      },
    }),
  ]);

  const tree: PublicAcademicChoiceSection[] = sections.map((section) => ({
    ...section,
    options: options
      .filter((option) => option.sectionId === section.id)
      .map(({ id, codeOption, nameOption }) => ({
        id,
        codeOption,
        nameOption,
      })),
  }));

  return {
    typebranch: branch.typebranch,
    sections: tree,
  };
}

function createReference() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `INS-${stamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function studentDisplayName(student: {
  prenom?: string;
  name: string;
}) {
  return `${student.prenom ?? ""} ${student.name}`.trim() || "Élève";
}

/**
 * Inscription publique multi-élèves : N demandes RegistrationRequest,
 * même siblingGroupId, 1 email de confirmation groupé.
 */
export async function registerStudentsOnline(
  raw: OnlineRegistrationBatchInput,
) {
  const parsed = onlineRegistrationBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Formulaire invalide",
    };
  }

  const data = parsed.data;
  const branch = await prisma.branch.findFirst({
    where: { id: data.branchId, isActive: true },
    select: {
      id: true,
      name: true,
      organizationId: true,
      typebranch: true,
      schoolYear: {
        where: { isCurrentYear: true, isArchived: false },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!branch) {
    return { success: false as const, message: "Ecole introuvable." };
  }

  if (isAtelierBranch(branch.typebranch)) {
    return {
      success: false as const,
      message:
        "Les inscriptions en ligne ne sont pas disponibles pour les ateliers.",
    };
  }

  if (
    !isCentreFormationBranch(branch.typebranch) &&
    data.guardians.length < 1
  ) {
    return {
      success: false as const,
      message: "Au moins un responsable est requis.",
    };
  }

  for (const student of data.students) {
    const requestedCycle = student.requestedCycle ?? branch.typebranch;
    if (requestedCycle !== "PRIMAIRE") continue;
    const age = ageFromDate(student.dateOfBirth);
    if (age === null || age < PRIMARY_MIN_AGE) {
      return {
        success: false as const,
        message: `Pour le primaire, ${studentDisplayName(student)} doit avoir au moins ${PRIMARY_MIN_AGE} ans.`,
      };
    }
  }

  const publishedInfo = data.termsInfoId
    ? await prisma.branchRegistrationInfo.findFirst({
        where: {
          id: data.termsInfoId,
          branchId: branch.id,
          isPublished: true,
        },
        select: { id: true },
      })
    : null;

  const siblingGroupId =
    data.students.length > 1 ? crypto.randomUUID() : null;
  const schoolYearId = branch.schoolYear[0]?.id ?? null;
  const familyExtra = data.familyExtra ?? {};
  const termsAcceptedAt = publishedInfo ? new Date() : null;
  const termsInfoId = publishedInfo?.id ?? null;

  const created = await prisma.$transaction(
    data.students.map((student) => {
      const reference = createReference();
      const {
        requestedLevel,
        requestedSection,
        requestedOption,
        requestedCycle,
        photoUrl,
        extra,
        ...identity
      } = student;
      const cteb =
        isCtebLevel(requestedLevel) ? getCtebLockDefaults() : null;
      return prisma.registrationRequest.create({
        data: {
          reference,
          branchId: branch.id,
          organizationId: branch.organizationId,
          schoolYearId,
          status: "PENDING",
          siblingGroupId,
          studentData: {
            ...identity,
            ...(extra ?? {}),
            familyExtra,
            ...(requestedCycle ? { requestedCycle } : {}),
          },
          guardiansData: data.guardians,
          requestedLevel,
          requestedSection: requestedSection || cteb?.sectionName || null,
          requestedOption: requestedOption || cteb?.optionName || null,
          photoUrl: photoUrl || null,
          consentAccepted: true,
          termsAcceptedAt,
          termsInfoId,
        },
        select: { reference: true },
      });
    }),
  );

  const references = created.map((row) => row.reference);
  const studentNames = data.students.map(studentDisplayName);
  const primaryGuardian =
    data.guardians.find((guardian) => guardian.isPrimary) ?? data.guardians[0];
  const confirmationEmail =
    primaryGuardian?.email?.trim() || data.students[0]?.email?.trim() || "";
  const recipientName =
    primaryGuardian != null
      ? `${primaryGuardian.prenom} ${primaryGuardian.name}`.trim()
      : studentNames[0] || "Responsable";
  const confirmationPhone = primaryGuardian?.telephone?.trim() || null;

  const studentsSummary = studentNames
    .map((name, index) => `${name} (${references[index]})`)
    .join(", ");
  const levelsSummary = data.students
    .map((s) => s.requestedLevel)
    .filter(Boolean)
    .join(", ");

  if (confirmationEmail || confirmationPhone) {
    try {
      await sendStudentRegistrationConfirmationEmail({
        to: confirmationEmail.toLowerCase(),
        phone: confirmationPhone,
        recipientName: recipientName || "Responsable",
        studentName: studentsSummary,
        reference: references.join(", "),
        branchName: branch.name,
        requestedLevel: levelsSummary,
        organizationId: branch.organizationId,
      });
    } catch (error) {
      console.error("STUDENT_REGISTRATION_CONFIRMATION_EMAIL_ERROR:", error);
    }
  }

  try {
    const managerEmails = await getBranchManagerEmails({
      branchId: branch.id,
      organizationId: branch.organizationId,
      kind: "inscription",
    });
    if (managerEmails.length > 0) {
      await sendBranchSubmissionNotificationEmail({
        to: managerEmails,
        kind: "inscription",
        reference: references.join(", "),
        branchName: branch.name,
        submitterName: recipientName || "Responsable",
        subjectName: studentsSummary,
        detailLabel:
          data.students.length > 1
            ? "Classes / niveaux souhaités"
            : "Classe / niveau souhaité",
        detailValue: levelsSummary,
      });
    }
  } catch (error) {
    console.error("STUDENT_REGISTRATION_BRANCH_NOTIFY_EMAIL_ERROR:", error);
  }

  const count = references.length;
  return {
    success: true as const,
    message: confirmationEmail
      ? count > 1
        ? `${count} demandes envoyees. Un email de confirmation vous a ete adresse.`
        : "Votre demande a ete envoyee. Un email de confirmation vous a ete adresse."
      : count > 1
        ? `${count} demandes envoyees et doivent etre confirmees par l'ecole.`
        : "Votre demande a ete envoyee et doit etre confirmee par l'ecole.",
    references,
    reference: references[0]!,
    siblingGroupId,
  };
}

/** Compat : une seule inscription (délègue au batch). */
export async function registerStudentOnline(raw: OnlineRegistrationInput) {
  return registerStudentsOnline({
    branchId: raw.branchId,
    students: [
      {
        ...raw.student,
        requestedLevel: raw.requestedLevel,
        requestedSection: raw.requestedSection,
        requestedOption: raw.requestedOption,
        photoUrl: raw.photoUrl,
      },
    ],
    guardians: raw.guardians,
    consentAccepted: raw.consentAccepted,
    termsInfoId: raw.termsInfoId,
  });
}
