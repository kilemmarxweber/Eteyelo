"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import { jobApplicationInputSchema } from "@/src/interfaces/JobApplication";
import { sendJobApplicationConfirmationEmail } from "@/lib/email/send-job-application-confirmation-email";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { createOrganizationMemberAction } from "@/app/admin/organizations/[organizationId]/members/actions";
import {
  consumeAdminCreatedUserPlainPassword,
  stashAdminCreatedUserPlainPassword,
} from "@/lib/admin-created-user-password";
import { generateSecurePassword } from "@/lib/generate-password";
import { generateSlug } from "@/lib/generated-identifiers";
import { matchesClassForLevel } from "@/lib/class-enrollment/match-class-for-level";

function parseDesiredClassTarget(desiredLevels: string | null | undefined) {
  if (!desiredLevels?.trim()) return null;
  const parts = desiredLevels
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return {
    level: parts[0],
    sectionName: parts.length >= 3 ? parts[1] : null,
    optionName: parts.length >= 3 ? parts[2] : parts[1] ?? null,
  };
}

function parseDesiredSubjects(desiredSubjects: string | null | undefined) {
  if (!desiredSubjects?.trim()) return [];
  return desiredSubjects
    .split(/[,;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Si la classe demandée existe déjà dans la branche, affecte l'enseignant
 * aux cours correspondants pour l'année en cours.
 */
async function assignHiredTeacherToDesiredClass(params: {
  branchId: string;
  teacherId: string;
  typebranch: string | null;
  desiredLevels: string | null;
  desiredSubjects: string | null;
}) {
  const target = parseDesiredClassTarget(params.desiredLevels);
  if (!target?.level) {
    return { assigned: 0, classNames: [] as string[], reason: "Niveau non précisé" };
  }

  const subjects = parseDesiredSubjects(params.desiredSubjects);
  const [schoolYear, option, classes, courses] = await Promise.all([
    prisma.schoolYear.findFirst({
      where: {
        branchId: params.branchId,
        isCurrentYear: true,
        isArchived: false,
      },
      select: { id: true },
    }),
    target.optionName
      ? prisma.option.findFirst({
          where: {
            branchId: params.branchId,
            statusOption: true,
            nameOption: { equals: target.optionName, mode: "insensitive" },
          },
          select: { id: true, nameOption: true },
        })
      : Promise.resolve(null),
    prisma.classe.findMany({
      where: {
        branchId: params.branchId,
        OR: [{ statusClasse: true }, { statusClasse: null }],
      },
      select: {
        id: true,
        nameClasse: true,
        level: true,
        parallel: true,
        optionId: true,
        option: { select: { id: true, nameOption: true } },
      },
      orderBy: [{ parallel: "asc" }, { nameClasse: "asc" }],
    }),
    subjects.length > 0
      ? prisma.cours.findMany({
          where: {
            branchId: params.branchId,
            AND: [
              { OR: [{ statusCours: true }, { statusCours: null }] },
              {
                OR: subjects.map((subject) => ({
                  nameCours: { contains: subject, mode: "insensitive" as const },
                })),
              },
            ],
          },
          select: { id: true, nameCours: true },
        })
      : Promise.resolve([]),
  ]);

  if (!schoolYear) {
    return {
      assigned: 0,
      classNames: [] as string[],
      reason: "Aucune année scolaire en cours",
    };
  }

  const matchingClasses = classes.filter((classe) =>
    matchesClassForLevel(classe, {
      typebranch: params.typebranch,
      level: target.level,
      optionId: option?.id ?? null,
      optionName: option?.nameOption ?? target.optionName,
    }),
  );

  if (matchingClasses.length === 0) {
    return {
      assigned: 0,
      classNames: [] as string[],
      reason: `Classe ${target.level} introuvable`,
    };
  }

  // Prefer classe simple (sans parallèle), sinon première parallèle.
  const preferredClass =
    matchingClasses.find((classe) => !classe.parallel) ?? matchingClasses[0];

  if (courses.length === 0) {
    return {
      assigned: 0,
      classNames: [preferredClass.nameClasse],
      reason: "Classe trouvée mais aucun cours correspondant aux matières",
    };
  }

  const existingTitulaire = await prisma.teaching.findFirst({
    where: {
      branchId: params.branchId,
      classeId: preferredClass.id,
      schoolYearId: schoolYear.id,
      titulaire: true,
      statusTeaching: { not: false },
    },
    select: { id: true },
  });

  let assigned = 0;
  for (const [index, cours] of courses.entries()) {
    const existing = await prisma.teaching.findFirst({
      where: {
        classeId: preferredClass.id,
        schoolYearId: schoolYear.id,
        coursId: cours.id,
      },
      select: { id: true, teacherId: true },
    });

    const makeTitulaire = !existingTitulaire && index === 0;

    if (existing) {
      if (existing.teacherId === params.teacherId) {
        assigned += 1;
        continue;
      }
      await prisma.teaching.update({
        where: { id: existing.id },
        data: {
          teacherId: params.teacherId,
          statusTeaching: true,
          branchId: params.branchId,
          ...(makeTitulaire ? { titulaire: true } : {}),
        },
      });
      assigned += 1;
      continue;
    }

    await prisma.teaching.create({
      data: {
        branchId: params.branchId,
        teacherId: params.teacherId,
        classeId: preferredClass.id,
        schoolYearId: schoolYear.id,
        coursId: cours.id,
        statusTeaching: true,
        titulaire: makeTitulaire,
      },
    });
    assigned += 1;
  }

  return {
    assigned,
    classNames: assigned > 0 ? [preferredClass.nameClasse] : [],
    reason:
      assigned > 0
        ? null
        : "Aucune affectation créée",
  };
}

export async function getActiveBranchesForJobApplication() {
  return prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      ville: true,
      pays: true,
      image: true,
      typebranch: true,
    },
  });
}

function createJobApplicationReference() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `CAN-${stamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function submitJobApplication(raw: unknown) {
  const parsed = jobApplicationInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Formulaire invalide",
    };
  }

  const data = parsed.data;
  const branch = await prisma.branch.findFirst({
    where: { id: data.branchId, isActive: true },
    select: { id: true, name: true, organizationId: true },
  });

  if (!branch) {
    return { success: false as const, message: "Établissement introuvable." };
  }

  const duplicatePending = await prisma.jobApplication.findFirst({
    where: {
      branchId: branch.id,
      email: data.email.toLowerCase(),
      status: { in: ["PENDING", "REVIEWED", "ACCEPTED"] },
    },
    select: { id: true },
  });

  if (duplicatePending) {
    return {
      success: false as const,
      message:
        "Une candidature est déjà en cours pour cet email dans cet établissement.",
    };
  }

  const reference = createJobApplicationReference();
  const dateOfBirth = new Date(data.dateOfBirth);
  if (Number.isNaN(dateOfBirth.getTime())) {
    return {
      success: false as const,
      message: "Date de naissance invalide.",
    };
  }

  await prisma.jobApplication.create({
    data: {
      reference,
      branchId: branch.id,
      organizationId: branch.organizationId,
      applicationType: data.applicationType,
      nom: data.nom,
      postnom: data.postnom,
      prenom: data.prenom,
      sexe: data.sexe,
      dateOfBirth,
      telephone: data.telephone,
      email: data.email.toLowerCase(),
      address: data.address,
      photoUrl: data.photoUrl || null,
      desiredSubjects: data.desiredSubjects || null,
      desiredLevels: data.desiredLevels || null,
      yearsOfExperience: data.yearsOfExperience ?? null,
      desiredOrgRole: data.desiredOrgRole || null,
      experienceSummary: data.experienceSummary || null,
      educationSummary: data.educationSummary || null,
      skills: data.skills || null,
      availability: data.availability || null,
      motivation: data.motivation || null,
      cvUrl: data.cvUrl,
      coverLetterUrl: data.coverLetterUrl,
      consentAccepted: data.consentAccepted,
    },
  });

  try {
    await sendJobApplicationConfirmationEmail({
      to: data.email.toLowerCase(),
      candidateName: `${data.prenom} ${data.nom}`,
      reference,
      applicationType: data.applicationType,
      branchName: branch.name,
    });
  } catch (error) {
    console.error("JOB_APPLICATION_CONFIRMATION_EMAIL_ERROR:", error);
  }

  return {
    success: true as const,
    message:
      "Votre candidature a été envoyée. Un email de confirmation vous a été adressé.",
    reference,
  };
}

async function requireJobApplicationContext() {
  const context = await requireBranchContext();
  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId: context.branchId,
      member: {
        userId: context.userId,
        organizationId: context.organizationId,
      },
    },
    select: { role: true },
  });

  if (!canManageOrganization(context.session, branchMember?.role)) {
    throw new Error("Vous n'avez pas la permission de gérer les candidatures.");
  }

  return context;
}

async function getAvailableUsername(base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

export const getJobApplicationsAction = action.handler(async () => {
  const { branchId, organizationId } = await requireJobApplicationContext();

  return prisma.jobApplication.findMany({
    where: {
      branchId,
      organizationId,
      status: {
        in: ["PENDING", "REVIEWED", "ACCEPTED", "REJECTED", "HIRED"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      reference: true,
      status: true,
      applicationType: true,
      nom: true,
      postnom: true,
      prenom: true,
      email: true,
      telephone: true,
      desiredSubjects: true,
      desiredLevels: true,
      desiredOrgRole: true,
      yearsOfExperience: true,
      cvUrl: true,
      coverLetterUrl: true,
      photoUrl: true,
      createdAt: true,
    },
  });
});

export const getJobApplicationDetailAction = action
  .input(z.object({ applicationId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireJobApplicationContext();

    const application = await prisma.jobApplication.findFirst({
      where: {
        id: input.applicationId,
        branchId,
        organizationId,
      },
    });

    if (!application) {
      throw new Error("Candidature introuvable.");
    }

    return application;
  });

export const reviewJobApplicationAction = action
  .input(z.object({ applicationId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId } =
      await requireJobApplicationContext();

    const updated = await prisma.jobApplication.updateMany({
      where: {
        id: input.applicationId,
        branchId,
        organizationId,
        status: "PENDING",
      },
      data: {
        status: "REVIEWED",
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      throw new Error("Cette candidature n'est plus disponible.");
    }

    return { applicationId: input.applicationId };
  });

export const acceptJobApplicationAction = action
  .input(z.object({ applicationId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId } =
      await requireJobApplicationContext();

    const updated = await prisma.jobApplication.updateMany({
      where: {
        id: input.applicationId,
        branchId,
        organizationId,
        status: { in: ["PENDING", "REVIEWED"] },
      },
      data: {
        status: "ACCEPTED",
        acceptedById: userId,
        acceptedAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      throw new Error("Cette candidature n'est plus disponible.");
    }

    return { applicationId: input.applicationId };
  });

export const rejectJobApplicationAction = action
  .input(
    z.object({
      applicationId: z.string().min(1),
      reason: z.string().trim().min(3, "Motif requis"),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId } =
      await requireJobApplicationContext();

    const updated = await prisma.jobApplication.updateMany({
      where: {
        id: input.applicationId,
        branchId,
        organizationId,
        status: { in: ["PENDING", "REVIEWED", "ACCEPTED"] },
      },
      data: {
        status: "REJECTED",
        rejectedReason: input.reason,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      throw new Error("Cette candidature n'est plus disponible.");
    }

    return { applicationId: input.applicationId };
  });

export const hireJobApplicationAction = action
  .input(z.object({ applicationId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId } =
      await requireJobApplicationContext();

    const application = await prisma.jobApplication.findFirst({
      where: {
        id: input.applicationId,
        branchId,
        organizationId,
        status: "ACCEPTED",
      },
    });

    if (!application) {
      throw new Error("Seules les candidatures acceptées peuvent être embauchées.");
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: application.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new Error(
        "Un compte existe déjà avec cet email. Utilisez la gestion manuelle des utilisateurs.",
      );
    }

    const usernameBase = generateSlug(
      `${application.prenom}.${application.nom}`,
      "candidat",
    );
    const username = await getAvailableUsername(usernameBase);
    const password = generateSecurePassword(16);
    const emailLower = application.email.toLowerCase();

    stashAdminCreatedUserPlainPassword(emailLower, password);

    let createdUserId: string | null = null;

    try {
      const orgRole =
        application.applicationType === "TEACHER"
          ? "teacher"
          : application.desiredOrgRole || "gestionnaire";

      const memberResult = await createOrganizationMemberAction({
        name: application.nom,
        prenom: application.prenom,
        postnom: application.postnom,
        sexe: application.sexe,
        telephone: application.telephone,
        email: emailLower,
        address: application.address,
        dateOfBirth: application.dateOfBirth,
        organizationId,
        branchId,
        orgRole,
      });

      if (!memberResult.ok) {
        consumeAdminCreatedUserPlainPassword(emailLower);
        throw new Error(memberResult.message);
      }

      createdUserId = memberResult.userId;

      await prisma.user.update({
        where: { id: memberResult.userId },
        data: {
          username,
          image: application.photoUrl || undefined,
        },
      });

      const branchMember = await prisma.branchMember.create({
        data: {
          memberId: memberResult.memberId,
          branchId,
          role:
            application.applicationType === "TEACHER" ? "TEACHER" : "DIRECTOR",
        },
      });

      let teacherId: string | null = null;
      let personnelId: string | null = null;

      if (application.applicationType === "TEACHER") {
        const teacher = await prisma.teacher.create({
          data: { branchMemberId: branchMember.id },
        });
        teacherId = teacher.id;
      } else {
        const personnel = await prisma.personnel.create({
          data: { branchMemberId: branchMember.id },
        });
        personnelId = personnel.id;
      }

      const hired = await prisma.jobApplication.updateMany({
        where: {
          id: application.id,
          status: "ACCEPTED",
        },
        data: {
          status: "HIRED",
          hiredById: userId,
          hiredAt: new Date(),
          teacherId,
          personnelId,
        },
      });

      if (hired.count !== 1) {
        throw new Error("Impossible de finaliser l'embauche.");
      }

      let teachingAssignment: {
        assigned: number;
        classNames: string[];
        reason: string | null;
      } = { assigned: 0, classNames: [], reason: null };

      if (application.applicationType === "TEACHER" && teacherId) {
        const branch = await prisma.branch.findUnique({
          where: { id: branchId },
          select: { typebranch: true },
        });
        teachingAssignment = await assignHiredTeacherToDesiredClass({
          branchId,
          teacherId,
          typebranch: branch?.typebranch ?? null,
          desiredLevels: application.desiredLevels,
          desiredSubjects: application.desiredSubjects,
        });
      }

      // L’email d’identifiants (avec rôle) est envoyé par le hook Better Auth
      // après createOrganizationMemberAction — pas de second envoi ici.
      consumeAdminCreatedUserPlainPassword(emailLower);

      const base = `/admin/organizations/${organizationId}/branches/${branchId}`;
      revalidatePath(`${base}/candidatures`);
      revalidatePath(`${base}/teacher`);
      revalidatePath(`${base}/personnel`);
      revalidatePath(`${base}/teaching`);

      return {
        applicationId: application.id,
        teacherId,
        personnelId,
        teachingAssignment,
      };
    } catch (error) {
      consumeAdminCreatedUserPlainPassword(emailLower);
      if (createdUserId) {
        await prisma.user
          .delete({ where: { id: createdUserId } })
          .catch(() => undefined);
      }
      throw error;
    }
  });
