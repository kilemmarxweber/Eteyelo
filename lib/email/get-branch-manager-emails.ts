import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const INSCRIPTION_NOTIFY_ROLES = new Set([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.CAISSIER,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
]);

const CANDIDATURE_NOTIFY_ROLES = new Set([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
]);

const ORG_WIDE_NOTIFY_ROLES = new Set([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
]);

const ABSENCE_NOTIFY_ROLES = new Set([
  ORG_ROLE.OWNER,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
]);

export type BranchAbsenceReviewer = {
  userId: string;
  email: string | null;
  name: string;
  telephone: string | null;
};

function memberHasRole(memberRole: string, allowed: Set<string>) {
  return memberRole
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .some((role) => allowed.has(role));
}

/**
 * Emails des responsables à notifier pour une inscription ou candidature publique.
 * — Membres rattachés à la branche avec un rôle métier pertinent
 * — Propriétaires / gestionnaires d'organisation (toutes branches)
 */
export async function getBranchManagerEmails(params: {
  branchId: string;
  organizationId: string;
  kind: "inscription" | "candidature";
}): Promise<string[]> {
  const allowed =
    params.kind === "inscription"
      ? INSCRIPTION_NOTIFY_ROLES
      : CANDIDATURE_NOTIFY_ROLES;

  const [branchLinked, orgWide] = await Promise.all([
    prisma.branchMember.findMany({
      where: {
        branchId: params.branchId,
        member: {
          organizationId: params.organizationId,
          isArchived: false,
        },
      },
      select: {
        role: true,
        member: {
          select: {
            role: true,
            user: { select: { email: true } },
          },
        },
      },
    }),
    prisma.member.findMany({
      where: {
        organizationId: params.organizationId,
        isArchived: false,
      },
      select: {
        role: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  const emails = new Set<string>();

  for (const row of branchLinked) {
    const email = row.member.user.email?.trim().toLowerCase();
    if (!email) continue;

    if (
      memberHasRole(row.member.role, allowed) ||
      row.role === "DIRECTOR" ||
      row.role === "ADMIN"
    ) {
      emails.add(email);
    }
  }

  for (const row of orgWide) {
    const email = row.user.email?.trim().toLowerCase();
    if (!email) continue;
    if (memberHasRole(row.role, ORG_WIDE_NOTIFY_ROLES)) {
      emails.add(email);
    }
  }

  return [...emails];
}

/**
 * Préfet, directeur, propriétaire (et directeur des études) rattachés à la branche.
 */
export async function getBranchAbsenceReviewers(params: {
  branchId: string;
  organizationId: string;
}): Promise<BranchAbsenceReviewer[]> {
  const [branchLinked, orgWide] = await Promise.all([
    prisma.branchMember.findMany({
      where: {
        branchId: params.branchId,
        member: {
          organizationId: params.organizationId,
          isArchived: false,
        },
      },
      select: {
        role: true,
        member: {
          select: {
            role: true,
            user: {
              select: {
                id: true,
                email: true,
                telephone: true,
                name: true,
                prenom: true,
                postnom: true,
              },
            },
          },
        },
      },
    }),
    prisma.member.findMany({
      where: {
        organizationId: params.organizationId,
        isArchived: false,
      },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            email: true,
            telephone: true,
            name: true,
            prenom: true,
            postnom: true,
          },
        },
      },
    }),
  ]);

  const byUserId = new Map<string, BranchAbsenceReviewer>();

  function addReviewer(
    user: {
      id: string;
      email: string | null;
      telephone: string | null;
      name: string;
      prenom: string | null;
      postnom: string | null;
    },
  ) {
    if (byUserId.has(user.id)) return;
    const name = [user.prenom, user.name, user.postnom]
      .filter(Boolean)
      .join(" ")
      .trim();
    byUserId.set(user.id, {
      userId: user.id,
      email: user.email?.trim().toLowerCase() || null,
      name: name || user.name,
      telephone: user.telephone,
    });
  }

  for (const row of branchLinked) {
    if (
      memberHasRole(row.member.role, ABSENCE_NOTIFY_ROLES) ||
      row.role === "DIRECTOR" ||
      row.role === "ADMIN"
    ) {
      addReviewer(row.member.user);
    }
  }

  for (const row of orgWide) {
    if (memberHasRole(row.role, ABSENCE_NOTIFY_ROLES)) {
      addReviewer(row.user);
    }
  }

  return [...byUserId.values()];
}
