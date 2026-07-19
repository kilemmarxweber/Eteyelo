"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { APP_ROLE } from "@/lib/permissions";
import {
  canManagePlatformEscalations,
  canManagePlatformSupport,
} from "@/lib/support/permissions";
import { listPlatformSupportEmails } from "@/lib/support/platform-support";
import { isSmtpConfigured, sendMail } from "@/lib/email/mailer";

function errMessage(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Une erreur est survenue.";
}

export async function searchPlatformSupportCandidatesAction(query: string) {
  if (!(await canManagePlatformSupport())) {
    return { ok: false as const, message: "Action non autorisée.", users: [] };
  }

  const q = query.trim();
  if (q.length < 2) {
    return { ok: true as const, users: [] };
  }

  const existingAgents = await prisma.platformSupportAgent.findMany({
    select: { userId: true },
  });
  const excludedUserIds = existingAgents.map((agent) => agent.userId);

  const users = await prisma.user.findMany({
    where: {
      ...(excludedUserIds.length > 0
        ? { id: { notIn: excludedUserIds } }
        : {}),
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
    take: 10,
  });

  return { ok: true as const, users };
}

const createPlatformAgentSchema = z.object({
  userId: z.string().min(1),
  displayTitle: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  specialties: z.array(z.string().trim().max(80)).max(10).default([]),
  image: z.string().url().optional().or(z.literal("")),
  isLead: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

const updatePlatformAgentSchema = createPlatformAgentSchema
  .omit({ userId: true })
  .extend({
    id: z.string().min(1),
    isActive: z.boolean().optional(),
  });

export async function createPlatformSupportAgentAction(
  input: z.infer<typeof createPlatformAgentSchema>,
) {
  if (!(await canManagePlatformSupport())) {
    return { ok: false as const, message: "Action non autorisée." };
  }

  const parsed = createPlatformAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Données invalides." };
  }

  const { userId, image, ...data } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { ok: false as const, message: "Utilisateur introuvable." };
    }

    const existing = await prisma.platformSupportAgent.findUnique({
      where: { userId },
    });
    if (existing) {
      return {
        ok: false as const,
        message: "Cet utilisateur est déjà agent support plateforme.",
      };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { role: APP_ROLE.PLATFORM_SUPPORT },
      }),
      prisma.platformSupportAgent.create({
        data: {
          userId,
          image: image || null,
          ...data,
        },
      }),
    ]);

    revalidatePath("/admin/platform-support");
    revalidatePath("/support");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: errMessage(e) };
  }
}

export async function updatePlatformSupportAgentAction(
  input: z.infer<typeof updatePlatformAgentSchema>,
) {
  if (!(await canManagePlatformSupport())) {
    return { ok: false as const, message: "Action non autorisée." };
  }

  const parsed = updatePlatformAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Données invalides." };
  }

  const { id, image, ...data } = parsed.data;

  try {
    await prisma.platformSupportAgent.update({
      where: { id },
      data: {
        image: image || null,
        ...data,
      },
    });
    revalidatePath("/admin/platform-support");
    revalidatePath("/support");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: errMessage(e) };
  }
}

export async function listPlatformEscalationsAction() {
  if (!(await canManagePlatformEscalations())) {
    return { ok: false as const, message: "Action non autorisée.", items: [] };
  }

  const items = await prisma.platformSupportEscalation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      requesterUser: { select: { id: true, name: true, email: true } },
      organizationSupport: {
        include: {
          member: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
      assignedPlatformAgent: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  return { ok: true as const, items };
}

const updateEscalationSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  assignedPlatformAgentId: z.string().optional().nullable(),
});

export async function updatePlatformEscalationAction(
  input: z.infer<typeof updateEscalationSchema>,
) {
  if (!(await canManagePlatformEscalations())) {
    return { ok: false as const, message: "Action non autorisée." };
  }

  const parsed = updateEscalationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Données invalides." };
  }

  const { id, status, assignedPlatformAgentId } = parsed.data;

  try {
    await prisma.platformSupportEscalation.update({
      where: { id },
      data: {
        status,
        assignedPlatformAgentId: assignedPlatformAgentId ?? null,
        resolvedAt:
          status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
      },
    });
    revalidatePath("/admin/platform-support");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: errMessage(e) };
  }
}

const createEscalationSchema = z.object({
  organizationId: z.string().min(1),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export async function createPlatformEscalationAction(
  input: z.infer<typeof createEscalationSchema>,
) {
  const { canEscalateToPlatformSupport } = await import(
    "@/lib/support/permissions"
  );
  const { getAuthSession } = await import("@/lib/support/permissions");
  const { getOrganizationSupportAgentForUser } = await import(
    "@/lib/support/organization-support"
  );

  const parsed = createEscalationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Données invalides." };
  }

  const { organizationId, subject, message, priority } = parsed.data;

  if (!(await canEscalateToPlatformSupport(organizationId))) {
    return {
      ok: false as const,
      message: "Vous n'êtes pas autorisé à contacter le support Klambocore.",
    };
  }

  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { ok: false as const, message: "Session requise." };
  }

  const orgAgent = await getOrganizationSupportAgentForUser(
    session.user.id,
    organizationId,
  );

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    const escalation = await prisma.platformSupportEscalation.create({
      data: {
        organizationId,
        organizationSupportId: orgAgent?.id ?? null,
        requesterUserId: session.user.id,
        subject,
        message,
        priority,
      },
    });

    if (isSmtpConfigured()) {
      const recipients = (await listPlatformSupportEmails()).join(", ");
      if (recipients) {
        await sendMail({
          to: recipients,
          subject: `[Kalasa Escalade] ${subject}`,
          text: [
            `Organisation: ${org?.name ?? organizationId}`,
            `Demandeur: ${session.user.name} (${session.user.email})`,
            `Priorité: ${priority}`,
            "",
            message,
          ].join("\n"),
        });
      }
    }

    revalidatePath(`/admin/organizations/${organizationId}/support`);
    return { ok: true as const, id: escalation.id };
  } catch (e) {
    return { ok: false as const, message: errMessage(e) };
  }
}

export async function listOrganizationEscalationsAction(organizationId: string) {
  const { canManageOrganizationSupport } = await import(
    "@/lib/support/permissions"
  );
  const { canEscalateToPlatformSupport } = await import(
    "@/lib/support/permissions"
  );

  if (
    !(await canManageOrganizationSupport(organizationId)) &&
    !(await canEscalateToPlatformSupport(organizationId))
  ) {
    return { ok: false as const, message: "Action non autorisée.", items: [] };
  }

  const items = await prisma.platformSupportEscalation.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      requesterUser: { select: { name: true, email: true } },
      assignedPlatformAgent: {
        include: { user: { select: { name: true } } },
      },
    },
  });

  return { ok: true as const, items };
}
