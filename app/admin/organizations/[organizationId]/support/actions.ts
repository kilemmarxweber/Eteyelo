"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ORG_ROLE } from "@/lib/permissions";
import { createOrganizationMemberAction } from "@/app/admin/organizations/[organizationId]/members/actions";
import { canManageOrganizationSupport } from "@/lib/support/permissions";

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

const createOrgSupportSchema = z.object({
  organizationId: z.string().min(1),
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(120),
  prenom: z.string().trim().min(2).max(80).optional(),
  postnom: z.string().trim().min(2).max(80).optional(),
  telephone: z.string().trim().max(40).optional(),
  displayTitle: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  specialties: z.array(z.string().trim().max(80)).max(10).default([]),
  isPrimary: z.boolean().default(false),
  branchIds: z.array(z.string()).default([]),
});

const updateOrgSupportSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  displayTitle: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  specialties: z.array(z.string().trim().max(80)).max(10).default([]),
  isActive: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  branchIds: z.array(z.string()).optional(),
});

export async function createOrganizationSupportAgentAction(
  input: z.infer<typeof createOrgSupportSchema>,
) {
  const parsed = createOrgSupportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Données invalides." };
  }

  const { organizationId, branchIds, ...memberData } = parsed.data;

  if (!(await canManageOrganizationSupport(organizationId))) {
    return { ok: false as const, message: "Action non autorisée." };
  }

  try {
    const memberResult = await createOrganizationMemberAction({
      organizationId,
      email: memberData.email,
      name: memberData.name,
      prenom: memberData.prenom,
      postnom: memberData.postnom,
      telephone: memberData.telephone,
      orgRole: ORG_ROLE.SUPPORT,
    });

    if (!memberResult.ok) {
      return { ok: false as const, message: memberResult.message };
    }

    const agent = await prisma.organizationSupportAgent.create({
      data: {
        memberId: memberResult.memberId,
        organizationId,
        displayTitle: memberData.displayTitle,
        bio: memberData.bio,
        specialties: memberData.specialties,
        isPrimary: memberData.isPrimary,
        branchScopes:
          branchIds.length > 0
            ? {
                create: branchIds.map((branchId) => ({ branchId })),
              }
            : {
                create: [{ branchId: null }],
              },
      },
    });

    revalidatePath(`/admin/organizations/${organizationId}/support`);
    return { ok: true as const, id: agent.id };
  } catch (e) {
    return { ok: false as const, message: errMessage(e) };
  }
}

export async function updateOrganizationSupportAgentAction(
  input: z.infer<typeof updateOrgSupportSchema>,
) {
  const parsed = updateOrgSupportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Données invalides." };
  }

  const { id, organizationId, branchIds, ...data } = parsed.data;

  if (!(await canManageOrganizationSupport(organizationId))) {
    return { ok: false as const, message: "Action non autorisée." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.organizationSupportAgent.update({
        where: { id },
        data,
      });

      if (branchIds !== undefined) {
        await tx.organizationSupportBranchScope.deleteMany({
          where: { supportId: id },
        });

        if (branchIds.length > 0) {
          await tx.organizationSupportBranchScope.createMany({
            data: branchIds.map((branchId) => ({
              supportId: id,
              branchId,
            })),
          });
        } else {
          await tx.organizationSupportBranchScope.create({
            data: { supportId: id, branchId: null },
          });
        }
      }
    });

    revalidatePath(`/admin/organizations/${organizationId}/support`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: errMessage(e) };
  }
}

export async function deleteOrganizationSupportAgentAction(input: {
  id: string;
  organizationId: string;
}) {
  if (!(await canManageOrganizationSupport(input.organizationId))) {
    return { ok: false as const, message: "Action non autorisée." };
  }

  try {
    const agent = await prisma.organizationSupportAgent.findUnique({
      where: { id: input.id },
      select: { memberId: true },
    });

    if (!agent) {
      return { ok: false as const, message: "Agent introuvable." };
    }

    await prisma.organizationSupportAgent.delete({ where: { id: input.id } });
    revalidatePath(`/admin/organizations/${input.organizationId}/support`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: errMessage(e) };
  }
}
