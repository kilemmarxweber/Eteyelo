"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";
import { action } from "@/lib/zsa";

function assertCanManage(
  session: Awaited<ReturnType<typeof requireBranchContext>>["session"],
) {
  if (!canAccessBranchOrgSettings(session)) {
    throw new Error("Action non autorisée.");
  }
}

export const getMessagingSettingsAction = action.handler(async () => {
  const { organizationId, session } = await requireBranchContext();
  assertCanManage(session);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { messagingEnabled: true },
  });

  return { enabled: org?.messagingEnabled !== false };
});

export const updateMessagingSettingsAction = action
  .input(z.object({ enabled: z.boolean() }))
  .handler(async ({ input }) => {
    const { organizationId, session, branchId } = await requireBranchContext();
    assertCanManage(session);

    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: { messagingEnabled: input.enabled },
      select: { messagingEnabled: true },
    });

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/settings/messagerie`,
    );
    revalidatePath(`/admin/organizations/${organizationId}/messagerie`);
    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}`,
    );

    return { enabled: org.messagingEnabled };
  });
