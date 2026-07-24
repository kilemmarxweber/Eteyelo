import { getCachedSession } from "@/lib/auth/get-session-cached";
import { prisma } from "@/lib/prisma";

export async function requireBranchContext() {
  const session = await getCachedSession();

  const userId = session?.user?.id;
  const organizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId;
  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;

  if (!userId || !organizationId || !branchId) {
    throw new Error("Aucune branche active");
  }

  // Si customSession a déjà chargé la branche courante, éviter un findFirst.
  if (
    session.branch?.id === branchId &&
    session.branch.typebranch != null
  ) {
    return {
      userId,
      organizationId,
      branchId,
      typebranch: session.branch.typebranch,
      session,
    };
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
