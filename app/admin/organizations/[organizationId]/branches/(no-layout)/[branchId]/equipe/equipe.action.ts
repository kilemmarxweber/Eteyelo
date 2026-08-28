"use server";

import { z } from "zod";

import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";

export type BranchTeamMember = {
  id: string;
  name: string;
  email: string | null;
  organizationRole: string;
  branchRole: string;
};

export const listBranchTeamMembersAction = action
  .input(
    z.object({
      organizationId: z.string().min(1),
      branchId: z.string().min(1),
    }),
  )
  .handler(async ({ input }): Promise<BranchTeamMember[]> => {
    const context = await requireBranchContext();

    if (
      context.organizationId !== input.organizationId ||
      context.branchId !== input.branchId
    ) {
      throw new Error("Branche active invalide.");
    }

    await assertBranchAreaAccess("school_admin", context.session, {
      organizationId: input.organizationId,
      branchId: input.branchId,
    });

    const members = await prisma.branchMember.findMany({
      where: {
        branchId: input.branchId,
        member: {
          organizationId: input.organizationId,
          isArchived: false,
        },
      },
      select: {
        id: true,
        role: true,
        member: {
          select: {
            role: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return members.map((member) => ({
      id: member.id,
      name: member.member.user.name,
      email: member.member.user.email,
      organizationRole: member.member.role,
      branchRole: String(member.role),
    }));
  });
