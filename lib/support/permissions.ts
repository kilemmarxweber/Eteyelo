import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  APP_ROLE,
  ORG_ROLE,
  hasPlatformSupportPrivileges,
  isAppAdminRole,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getOrganizationSupportAgentForUser } from "@/lib/support/organization-support";

export async function getAuthSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function isActivePlatformSupportAgentUser(
  userId: string,
): Promise<boolean> {
  const profile = await prisma.platformSupportAgent.findUnique({
    where: { userId },
    select: { isActive: true },
  });
  return profile?.isActive === true;
}

/** Peut gérer le support plateforme Klambocore. */
export async function canManagePlatformSupport(): Promise<boolean> {
  const session = await getAuthSession();
  if (!session?.user?.id) return false;
  if (isAppAdminRole(session.user.role)) return true;
  return false;
}

/** Accès à l'espace support plateforme (agents ou escalades). */
export async function canAccessPlatformSupportArea(): Promise<boolean> {
  return (
    (await canManagePlatformSupport()) ||
    (await canManagePlatformEscalations())
  );
}

/** Peut traiter les escalades Klambocore. */
export async function canManagePlatformEscalations(): Promise<boolean> {
  const session = await getAuthSession();
  if (!session?.user?.id) return false;
  if (hasPlatformSupportPrivileges(session.user.role)) {
    if (isAppAdminRole(session.user.role)) return true;
    return isActivePlatformSupportAgentUser(session.user.id);
  }
  return false;
}

/** Peut gérer les agents support d'une organisation. */
export async function canManageOrganizationSupport(
  organizationId: string,
): Promise<boolean> {
  const session = await getAuthSession();
  if (!session?.user?.id) return false;
  if (isAppAdminRole(session.user.role)) return true;

  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });

  const role = member?.role?.split(",")[0]?.trim();
  return role === ORG_ROLE.OWNER || role === ORG_ROLE.GESTIONNAIRE;
}

/** Est un agent support actif dans l'organisation (peut escalader vers Klambocore). */
export async function canEscalateToPlatformSupport(
  organizationId: string,
): Promise<boolean> {
  const session = await getAuthSession();
  if (!session?.user?.id) return false;
  if (await canManagePlatformEscalations()) return true;

  const agent = await getOrganizationSupportAgentForUser(
    session.user.id,
    organizationId,
  );
  return agent != null;
}
