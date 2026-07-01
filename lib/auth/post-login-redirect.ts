import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { BranchRole } from "@/prisma/generated/prisma/enums";

const ECODIM_ORG_ROLES = new Set<string>([
  ORG_ROLE.RESPONSABLE,
  ORG_ROLE.MONITEUR,
  ORG_ROLE.SURVEILLANT,
]);

const ORG_HOME_ROLES = new Set<string>([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
]);
const TEACHER_BRANCH_ROLES = [BranchRole.TEACHER];

function normalizeRole(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => normalizeRole(role))
    .filter(Boolean);
}

function hasRole(value: string | null | undefined, role: string) {
  return splitRoles(value).includes(normalizeRole(role));
}

async function getUserBranchId(userId: string, organizationId: string) {
  const activeBranchMember = await prisma.branchMember.findFirst({
    where: {
      role: { in: TEACHER_BRANCH_ROLES },
      member: {
        userId,
        organizationId,
      },
      branch: {
        organizationId,
        isActive: true,
      },
    },
    select: {
      branchId: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (activeBranchMember?.branchId) {
    return activeBranchMember.branchId;
  }

  const branchMember = await prisma.branchMember.findFirst({
    where: {
      role: { in: TEACHER_BRANCH_ROLES },
      member: {
        userId,
        organizationId,
      },
      branch: {
        organizationId,
      },
    },
    select: {
      branchId: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return branchMember?.branchId ?? null;
}

export async function resolvePostLoginPath(requestHeaders: Headers): Promise<string> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return "/auth/sign-in";
  }

  const membership = await getUserOrganizationMembership(session.user.id);
  if (!membership && normalizeRole(session.user.role) === APP_ROLE.ADMIN) {
    return "/admin";
  }

  if (!membership) {
    return "/admin";
  }

  await auth.api.setActiveOrganization({
    body: { organizationId: membership.organizationId },
    headers: requestHeaders,
  });

  const base = `/admin/organizations/${membership.organizationId}`;
  const roles = splitRoles(membership.role);
  const isOrgHomeRole = roles.some((role) => ORG_HOME_ROLES.has(role));
  const isEcodimRole = roles.some((role) => ECODIM_ORG_ROLES.has(role));
  const isTeacherRole = hasRole(membership.role, ORG_ROLE.TEACHER);
  const teacherBranchId = await getUserBranchId(
    session.user.id,
    membership.organizationId,
  );

  if (teacherBranchId && (isTeacherRole || (!isOrgHomeRole && !isEcodimRole))) {
    if (session.session.id) {
      await prisma.session.update({
        where: {
          id: session.session.id,
        },
        data: {
          activeOrganizationId: membership.organizationId,
          activeBranchId: teacherBranchId,
        },
      });
    }

    return `${base}/branches/${teacherBranchId}`;
  }

  if (isEcodimRole) {
    return `${base}/ecodim`;
  }
  if (isOrgHomeRole) {
    return base;
  }

  return base;
}
