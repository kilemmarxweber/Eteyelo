import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireBranchContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.user?.id;
  const organizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId;
  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;

  if (!userId || !organizationId || !branchId) {
    throw new Error("Aucune branche active");
  }

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      organizationId,
    },
    select: {
      id: true,
      typebranch: true,
    },
  });

  if (!branch) {
    throw new Error("Branche introuvable dans cette organisation");
  }

  return {
    userId,
    organizationId,
    branchId,
    typebranch: branch.typebranch,
    session,
  };
}
