import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";

const DEFAULT_OWNER_EMAIL = "owner@eteyelo.cd";
const DEFAULT_OWNER_PASSWORD = "Owner123!";

export type MemberRoleConversion = {
  userId: string;
  email: string | null;
  memberId: string;
  organizationId: string;
  fromRole: string;
  toRole: string;
};

export type SuperAdminPromotion = {
  userId: string;
  email: string | null;
  fromRole: string;
  toRole: string;
};

export type DuplicateMembershipCleanup = {
  userId: string;
  email: string | null;
  keptMemberId: string;
  keptOrganizationId: string;
  removedMemberIds: string[];
  removedOrganizationIds: string[];
};

export type OrganizationRolesAudit = {
  usersByAppRole: Record<string, number>;
  membersByRole: Record<string, number>;
  usersWithMultipleMemberships: number;
  platformOwners: number;
  appAdminsWithMemberOwner: number;
};

export type MigrateOrganizationRolesReport = {
  dryRun: boolean;
  before: OrganizationRolesAudit;
  after: OrganizationRolesAudit;
  memberRoleConversions: MemberRoleConversion[];
  legacySlugConversions: MemberRoleConversion[];
  organizationRoleSlugRenames: Array<{
    id: string;
    organizationId: string;
    fromRole: string;
    toRole: string;
  }>;
  obsoleteOrganizationRolesRemoved: number;
  superAdminPromotions: SuperAdminPromotion[];
  duplicateMembershipsRemoved: DuplicateMembershipCleanup[];
  platformOwnerCreated: boolean;
  platformOwnerEmail: string | null;
  ownerMembershipsRemoved: number;
};

type MigrateOrganizationRolesOptions = {
  dryRun?: boolean;
  ensureOwnerAccount?: boolean;
};

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

function joinRoles(roles: string[]) {
  return [...new Set(roles)].join(",");
}

function convertAdminMemberOwnerToGestionnaire(memberRole: string) {
  const roles = splitRoles(memberRole);
  if (!roles.includes(ORG_ROLE.OWNER)) {
    return null;
  }

  return joinRoles(
    roles.map((role) =>
      role === ORG_ROLE.OWNER ? ORG_ROLE.GESTIONNAIRE : role,
    ),
  );
}

/** Mapping 2A : anciens slugs org → nouveaux. */
const LEGACY_ORG_ROLE_MAP: Record<string, string> = {
  surveillant: ORG_ROLE.SUPERVISEUR,
  responsable: ORG_ROLE.DIRECTEUR,
  moniteur: ORG_ROLE.PREFET,
};

function convertLegacyOrganizationMemberRole(memberRole: string) {
  const roles = splitRoles(memberRole);
  let changed = false;
  const nextRoles = roles.map((role) => {
    const mapped = LEGACY_ORG_ROLE_MAP[role];
    if (mapped && mapped !== role) {
      changed = true;
      return mapped;
    }
    return role;
  });

  if (!changed) return null;
  return joinRoles(nextRoles);
}

async function auditOrganizationRoles(): Promise<OrganizationRolesAudit> {
  const [
    users,
    members,
    multiMembershipUsers,
    platformOwners,
    appAdminsWithMemberOwner,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    }),
    prisma.member.groupBy({
      by: ["role"],
      _count: { _all: true },
    }),
    prisma.member.groupBy({
      by: ["userId"],
      _count: { _all: true },
      having: {
        userId: {
          _count: {
            gt: 1,
          },
        },
      },
    }),
    prisma.user.count({
      where: { role: APP_ROLE.OWNER },
    }),
    prisma.member.count({
      where: {
        role: {
          contains: ORG_ROLE.OWNER,
        },
        user: {
          role: APP_ROLE.ADMIN,
        },
      },
    }),
  ]);

  return {
    usersByAppRole: Object.fromEntries(
      users.map((entry) => [entry.role ?? "null", entry._count._all]),
    ),
    membersByRole: Object.fromEntries(
      members.map((entry) => [entry.role, entry._count._all]),
    ),
    usersWithMultipleMemberships: multiMembershipUsers.length,
    platformOwners: platformOwners,
    appAdminsWithMemberOwner: appAdminsWithMemberOwner,
  };
}

async function ensureDefaultPlatformOwner(dryRun: boolean) {
  const existingOwner = await prisma.user.findFirst({
    where: { role: APP_ROLE.OWNER },
    select: { id: true, email: true },
  });

  if (existingOwner) {
    return {
      platformOwnerCreated: false,
      platformOwnerEmail: existingOwner.email,
    };
  }

  if (dryRun) {
    return {
      platformOwnerCreated: true,
      platformOwnerEmail: DEFAULT_OWNER_EMAIL,
    };
  }

  const hashedPassword = await hashPassword(DEFAULT_OWNER_PASSWORD);
  const owner = await prisma.user.upsert({
    where: { email: DEFAULT_OWNER_EMAIL },
    update: {
      role: APP_ROLE.OWNER,
      emailVerified: true,
      statusUser: true,
    },
    create: {
      username: "owner",
      email: DEFAULT_OWNER_EMAIL,
      name: "Root Proprietaire Plateforme",
      prenom: "Root",
      postnom: "Plateforme",
      role: APP_ROLE.OWNER,
      emailVerified: true,
      statusUser: true,
    },
    select: { id: true, email: true },
  });

  const existingAccount = await prisma.account.findFirst({
    where: {
      userId: owner.id,
      providerId: "credential",
    },
  });

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        accountId: owner.id,
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: owner.id,
        providerId: "credential",
        userId: owner.id,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  return {
    platformOwnerCreated: true,
    platformOwnerEmail: owner.email,
  };
}

export async function migrateOrganizationRoles(
  options: MigrateOrganizationRolesOptions = {},
): Promise<MigrateOrganizationRolesReport> {
  const dryRun = options.dryRun ?? false;
  const ensureOwnerAccount = options.ensureOwnerAccount ?? true;
  const before = await auditOrganizationRoles();

  const memberRoleConversions: MemberRoleConversion[] = [];
  const legacySlugConversions: MemberRoleConversion[] = [];
  const organizationRoleSlugRenames: MigrateOrganizationRolesReport["organizationRoleSlugRenames"] =
    [];
  let obsoleteOrganizationRolesRemoved = 0;
  const superAdminPromotions: SuperAdminPromotion[] = [];
  const duplicateMembershipsRemoved: DuplicateMembershipCleanup[] = [];
  let ownerMembershipsRemoved = 0;

  const adminMembersWithOwnerRole = await prisma.member.findMany({
    where: {
      user: {
        role: APP_ROLE.ADMIN,
      },
      role: {
        contains: ORG_ROLE.OWNER,
      },
    },
    select: {
      id: true,
      role: true,
      organizationId: true,
      userId: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  for (const member of adminMembersWithOwnerRole) {
    const nextRole = convertAdminMemberOwnerToGestionnaire(member.role);
    if (!nextRole || nextRole === member.role) {
      continue;
    }

    memberRoleConversions.push({
      userId: member.userId,
      email: member.user.email,
      memberId: member.id,
      organizationId: member.organizationId,
      fromRole: member.role,
      toRole: nextRole,
    });

    if (!dryRun) {
      await prisma.member.update({
        where: { id: member.id },
        data: { role: nextRole },
      });
    }
  }

  const membersWithLegacySlugs = await prisma.member.findMany({
    where: {
      OR: [
        { role: { contains: "surveillant" } },
        { role: { contains: "responsable" } },
        { role: { contains: "moniteur" } },
      ],
    },
    select: {
      id: true,
      role: true,
      organizationId: true,
      userId: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  for (const member of membersWithLegacySlugs) {
    const nextRole = convertLegacyOrganizationMemberRole(member.role);
    if (!nextRole || nextRole === member.role) {
      continue;
    }

    legacySlugConversions.push({
      userId: member.userId,
      email: member.user.email,
      memberId: member.id,
      organizationId: member.organizationId,
      fromRole: member.role,
      toRole: nextRole,
    });

    if (!dryRun) {
      await prisma.member.update({
        where: { id: member.id },
        data: { role: nextRole },
      });
    }
  }

  const legacyOrganizationRoles = await prisma.organizationRole.findMany({
    where: {
      role: {
        in: Object.keys(LEGACY_ORG_ROLE_MAP),
      },
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
      permission: true,
    },
  });

  for (const orgRole of legacyOrganizationRoles) {
    const nextSlug = LEGACY_ORG_ROLE_MAP[orgRole.role];
    if (!nextSlug) continue;

    const existingTarget = await prisma.organizationRole.findUnique({
      where: {
        organizationId_role: {
          organizationId: orgRole.organizationId,
          role: nextSlug,
        },
      },
      select: { id: true },
    });

    if (existingTarget) {
      obsoleteOrganizationRolesRemoved += 1;
      if (!dryRun) {
        await prisma.organizationRole.delete({ where: { id: orgRole.id } });
      }
      continue;
    }

    organizationRoleSlugRenames.push({
      id: orgRole.id,
      organizationId: orgRole.organizationId,
      fromRole: orgRole.role,
      toRole: nextSlug,
    });

    if (!dryRun) {
      await prisma.organizationRole.update({
        where: { id: orgRole.id },
        data: { role: nextSlug },
      });
    }
  }

  const legacySuperAdmins = await prisma.user.findMany({
    where: {
      role: APP_ROLE.ADMIN,
      members: {
        none: {},
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  for (const user of legacySuperAdmins) {
    superAdminPromotions.push({
      userId: user.id,
      email: user.email,
      fromRole: user.role ?? APP_ROLE.ADMIN,
      toRole: APP_ROLE.OWNER,
    });

    if (!dryRun) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: APP_ROLE.OWNER },
      });
    }
  }

  const usersWithDuplicates = await prisma.member.groupBy({
    by: ["userId"],
    _count: { _all: true },
    having: {
      userId: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  for (const group of usersWithDuplicates) {
    const memberships = await prisma.member.findMany({
      where: { userId: group.userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        organizationId: true,
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    });

    if (memberships.length <= 1) {
      continue;
    }

    const preferredMembership =
      memberships.find((membership) => membership.user.role === APP_ROLE.ADMIN) ??
      memberships[0];
    const removed = memberships.filter(
      (membership) => membership.id !== preferredMembership.id,
    );

    duplicateMembershipsRemoved.push({
      userId: group.userId,
      email: preferredMembership.user.email,
      keptMemberId: preferredMembership.id,
      keptOrganizationId: preferredMembership.organizationId,
      removedMemberIds: removed.map((membership) => membership.id),
      removedOrganizationIds: removed.map(
        (membership) => membership.organizationId,
      ),
    });

    if (!dryRun) {
      await prisma.member.deleteMany({
        where: {
          id: {
            in: removed.map((membership) => membership.id),
          },
        },
      });
    }
  }

  const platformOwnersWithMembership = await prisma.member.findMany({
    where: {
      user: {
        role: APP_ROLE.OWNER,
      },
    },
    select: {
      id: true,
    },
  });

  ownerMembershipsRemoved = platformOwnersWithMembership.length;

  if (ownerMembershipsRemoved > 0 && !dryRun) {
    await prisma.member.deleteMany({
      where: {
        id: {
          in: platformOwnersWithMembership.map((membership) => membership.id),
        },
      },
    });
  }

  let platformOwnerCreated = false;
  let platformOwnerEmail: string | null = null;

  if (ensureOwnerAccount) {
    const ownerResult = await ensureDefaultPlatformOwner(dryRun);
    platformOwnerCreated = ownerResult.platformOwnerCreated;
    platformOwnerEmail = ownerResult.platformOwnerEmail;
  }

  const after = dryRun
    ? {
        ...before,
        usersWithMultipleMemberships: Math.max(
          0,
          before.usersWithMultipleMemberships -
            duplicateMembershipsRemoved.length,
        ),
        appAdminsWithMemberOwner: Math.max(
          0,
          before.appAdminsWithMemberOwner - memberRoleConversions.length,
        ),
        platformOwners:
          before.platformOwners +
          superAdminPromotions.length +
          (platformOwnerCreated ? 1 : 0),
      }
    : await auditOrganizationRoles();

  return {
    dryRun,
    before,
    after,
    memberRoleConversions,
    legacySlugConversions,
    organizationRoleSlugRenames,
    obsoleteOrganizationRolesRemoved,
    superAdminPromotions,
    duplicateMembershipsRemoved,
    platformOwnerCreated,
    platformOwnerEmail,
    ownerMembershipsRemoved,
  };
}

export function formatMigrationReport(report: MigrateOrganizationRolesReport) {
  const lines: string[] = [];

  lines.push(
    report.dryRun
      ? "Migration organisation roles (dry-run)"
      : "Migration organisation roles",
  );
  lines.push("=".repeat(72));
  lines.push("");
  lines.push("Audit avant:");
  lines.push(JSON.stringify(report.before, null, 2));
  lines.push("");
  lines.push(
    `Conversions member owner -> gestionnaire: ${report.memberRoleConversions.length}`,
  );
  for (const item of report.memberRoleConversions) {
    lines.push(
      `  - ${item.email ?? item.userId} (${item.memberId}): ${item.fromRole} -> ${item.toRole}`,
    );
  }
  lines.push("");
  lines.push(
    `Conversions slugs legacy (2A): ${report.legacySlugConversions.length}`,
  );
  for (const item of report.legacySlugConversions) {
    lines.push(
      `  - ${item.email ?? item.userId} (${item.memberId}): ${item.fromRole} -> ${item.toRole}`,
    );
  }
  lines.push("");
  lines.push(
    `Renames OrganizationRole: ${report.organizationRoleSlugRenames.length}`,
  );
  for (const item of report.organizationRoleSlugRenames) {
    lines.push(
      `  - org ${item.organizationId}: ${item.fromRole} -> ${item.toRole}`,
    );
  }
  lines.push(
    `OrganizationRole obsolete supprimes: ${report.obsoleteOrganizationRolesRemoved}`,
  );
  lines.push("");
  lines.push(
    `Promotions super admin -> owner: ${report.superAdminPromotions.length}`,
  );
  for (const item of report.superAdminPromotions) {
    lines.push(
      `  - ${item.email ?? item.userId}: ${item.fromRole} -> ${item.toRole}`,
    );
  }
  lines.push("");
  lines.push(
    `Memberships dupliques supprimes: ${report.duplicateMembershipsRemoved.length}`,
  );
  for (const item of report.duplicateMembershipsRemoved) {
    lines.push(
      `  - ${item.email ?? item.userId}: garde ${item.keptOrganizationId}, retire ${item.removedOrganizationIds.join(", ")}`,
    );
  }
  lines.push("");
  lines.push(
    `Memberships retires des owners plateforme: ${report.ownerMembershipsRemoved}`,
  );
  if (report.platformOwnerCreated) {
    lines.push(
      `Compte owner plateforme assure: ${report.platformOwnerEmail ?? DEFAULT_OWNER_EMAIL}`,
    );
  }
  lines.push("");
  lines.push("Audit apres:");
  lines.push(JSON.stringify(report.after, null, 2));

  return lines.join("\n");
}

export async function auditOrganizationRolesForCli() {
  const audit = await auditOrganizationRoles();
  return JSON.stringify(audit, null, 2);
}
