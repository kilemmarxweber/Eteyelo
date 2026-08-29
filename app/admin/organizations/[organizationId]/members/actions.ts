"use server";

import z from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ZodError } from "zod";
import { auth } from "@/lib/auth";
import {
  consumeAdminCreatedUserPlainPassword,
  stashAdminCreatedUserPlainPassword,
} from "@/lib/admin-created-user-password";
import { generateSecurePassword } from "@/lib/generate-password";
import { prisma } from "@/lib/prisma";
import {
  createOrgMemberSchema,
  removeOrgMemberSchema,
  archiveOrgMemberSchema,
  resetOrgMemberPasswordSchema,
  updateOrgMemberSchema,
  type CreateOrgMemberInput,
  type RemoveOrgMemberInput,
  type ArchiveOrgMemberInput,
  type ResetOrgMemberPasswordInput,
  updateUserSchema,
  type UpdateOrgMemberInput,
} from "./schema";
import { sendResetPasswordEmail } from "@/lib/email/send-reset-password-email";
import { createUserForOrganizationMember } from "@/lib/auth/create-organization-user";
import { guardOrganizationMemberPermission } from "@/lib/auth/has-organization-permission";
import {
  removeOrganizationMember,
  updateOrganizationMemberRole,
} from "@/lib/auth/organization-member-operations";
import { buildIsArchivedUpdate } from "@/lib/archive";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { orgRoleToBranchRole } from "@/lib/auth/org-role-to-branch-role";
import { ensureBranchMemberRoleProfiles } from "@/lib/auth/ensure-branch-member-profile";
import { ORG_ROLE } from "@/lib/permissions";
import type { BranchRole } from "@/prisma/generated/prisma/enums";
import {
  assignBranchMemberCycles,
  canViewAllDirectoryUsers,
  isCycleGlobalRole,
  sessionCanViewAllDirectoryUsers,
} from "@/lib/auth/cycle-scope";
import {
  cycleLabel,
  getBranchCycles,
  isMultiCycleBranch,
  normalizeCycle,
  type Cycle,
} from "@/lib/cycle";

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

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

function uniqueBranchIds(ids: Array<string | undefined | null>): string[] {
  return [...new Set(ids.map((id) => id?.trim()).filter(Boolean) as string[])];
}

async function resolveValidBranchIds(
  organizationId: string,
  branchIds: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  const unique = uniqueBranchIds(branchIds);
  if (unique.length === 0) {
    return { ok: false, message: "Sélectionnez au moins une branche." };
  }

  const branches = await prisma.branch.findMany({
    where: {
      organizationId,
      id: { in: unique },
      isActive: true,
    },
    select: { id: true },
  });

  if (branches.length !== unique.length) {
    return {
      ok: false,
      message: "Une ou plusieurs branches sont invalides ou inactives.",
    };
  }

  return { ok: true, ids: unique };
}

function branchMemberHasLinkedProfile(counts: {
  teacher: number;
  parent: number;
  student: number;
  personel: number;
  schedule: number;
}) {
  return (
    counts.teacher +
      counts.parent +
      counts.student +
      counts.personel +
      counts.schedule >
    0
  );
}

async function syncMemberBranches(params: {
  memberId: string;
  organizationId: string;
  branchIds: string[];
  branchRole: BranchRole;
  orgRole?: string | null;
  branchCycles?: Record<string, string[]> | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const {
    memberId,
    organizationId,
    branchIds,
    branchRole,
    orgRole,
    branchCycles,
  } = params;
  const selected = new Set(branchIds);

  const existing = await prisma.branchMember.findMany({
    where: { memberId, branch: { organizationId } },
    select: {
      id: true,
      branchId: true,
      role: true,
      branch: { select: { name: true } },
      _count: {
        select: {
          teacher: true,
          parent: true,
          student: true,
          personel: true,
          schedule: true,
        },
      },
    },
  });

  const blocked = existing.filter(
    (row) =>
      !selected.has(row.branchId) &&
      branchMemberHasLinkedProfile(row._count),
  );
  if (blocked.length > 0) {
    const names = blocked.map((row) => row.branch.name).join(", ");
    return {
      ok: false,
      message: `Impossible de retirer l’accès à : ${names}. Ce membre y a encore un profil (élève, enseignant, parent ou personnel).`,
    };
  }

  const previousRolesByBranchMemberId: Record<string, BranchRole> = {};
  for (const row of existing) {
    if (selected.has(row.branchId)) {
      previousRolesByBranchMemberId[row.id] = row.role;
    }
  }

  await prisma.$transaction(async (tx) => {
    const toDeleteIds = existing
      .filter((row) => !selected.has(row.branchId))
      .map((row) => row.id);
    if (toDeleteIds.length > 0) {
      await tx.branchMember.deleteMany({ where: { id: { in: toDeleteIds } } });
    }

    for (const branchId of branchIds) {
      const found = existing.find((row) => row.branchId === branchId);
      if (found) {
        // Toujours aligner le BranchRole + réactiver le lien branche
        // (Teacher.isActive / Personnel.isActive gèrent le profil métier).
        await tx.branchMember.update({
          where: { id: found.id },
          data: {
            role: branchRole,
            isActive: true,
            deactivatedAt: null,
          },
        });
        continue;
      }

      await tx.branchMember.create({
        data: {
          memberId,
          branchId,
          role: branchRole,
          isActive: true,
        },
      });
    }
  });

  try {
    await ensureBranchMemberRoleProfiles({
      memberId,
      organizationId,
      previousRolesByBranchMemberId,
    });
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }

  const branchMembers = await prisma.branchMember.findMany({
    where: {
      memberId,
      branchId: { in: branchIds },
      branch: { organizationId },
    },
    select: { id: true, branchId: true },
  });

  for (const bm of branchMembers) {
    try {
      await assignBranchMemberCycles({
        branchMemberId: bm.id,
        branchId: bm.branchId,
        orgRole,
        cycles: branchCycles?.[bm.branchId] ?? [],
      });
    } catch (e) {
      return { ok: false, message: errMessage(e) };
    }
  }

  for (const branchId of branchIds) {
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/teacher`,
    );
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/student`,
    );
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/personnel`,
    );
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/parent`,
    );
  }

  return { ok: true };
}

function normalizeStatusUser(
  value: string | boolean | undefined,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  return undefined;
}
type CreateOrganizationMemberResult =
  | {
      ok: true;
      userId: string;
      memberId: string;
    }
  | {
      ok: false;
      message: string;
    };
export async function createOrganizationMemberAction(
  input: CreateOrgMemberInput,
  options?: {
    revalidateMembersPage?: boolean;
  },
): Promise<CreateOrganizationMemberResult> {
  const parsed = createOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const guard = await guardOrganizationMemberPermission(
    parsed.data.organizationId,
    { member: ["create"] },
  );
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  const {
    organizationId,
    branchId,
    branchIds: requestedBranchIds,
    branchCycles,
    email,
    name,
    orgRole,
    prenom,
    sexe,
    postnom,
    dateOfBirth,
    statusUser,
    image,
  } = parsed.data;
  const telephone = parsed.data.telephone?.trim() || undefined;
  const address = parsed.data.address?.trim() || undefined;
  const h = await headers();
  const emailLower = email.toLowerCase();
  const password = generateSecurePassword(16);

  const requestedIds = uniqueBranchIds([
    ...(requestedBranchIds ?? []),
    branchId,
  ]);
  const formRequestedAssignment = requestedBranchIds !== undefined;
  let assignedBranchIds: string[] = [];
  if (formRequestedAssignment) {
    const branches = await resolveValidBranchIds(organizationId, requestedIds);
    if (!branches.ok) {
      return branches;
    }
    assignedBranchIds = branches.ids;
  }

  const primaryBranchId = assignedBranchIds[0] ?? branchId;

  const [organization, branch] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    primaryBranchId
      ? prisma.branch.findUnique({
          where: { id: primaryBranchId },
          select: {
            name: true,
            tel: true,
            adresse: true,
            ville: true,
            commune: true,
            province: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const branchAddress = branch
    ? [branch.adresse, branch.commune, branch.ville, branch.province]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(", ")
    : undefined;

  stashAdminCreatedUserPlainPassword(emailLower, password, {
    role: orgRoleLabel(orgRole),
    organizationName: organization?.name,
    branchName: branch?.name,
    branchPhone: branch?.tel?.trim() || undefined,
    branchAddress: branchAddress || undefined,
    phone: telephone,
  });

  let userId: string | null = null;
  try {
    const sexeMap: Record<string, "M" | "F"> = {
      masculin: "M",
      feminin: "F",
    };
    // createUser = plugin admin (user:create). Après garde org member:create,
    // appel serveur sans headers — voir createUserForOrganizationMember.
    const created = await createUserForOrganizationMember({
      email: emailLower,
      name,
      password,
      data: {
        prenom: prenom?.trim() || null,
        postnom: postnom?.trim() || null,
        sexe: sexeMap[sexe as string],
        telephone,
        dateOfBirth,
        address,
        statusUser: normalizeStatusUser(statusUser),
      },
    });
    const user = (created as { user?: { id: string } } | null)?.user;
    if (!user?.id) {
      return {
        ok: false,
        message: "Création du compte impossible (réponse inattendue).",
      };
    }
    userId = user.id;

    const imageUrl = image?.trim();
    if (imageUrl) {
      await prisma.user.update({
        where: { id: user.id },
        data: { image: imageUrl },
      });
    }

    // addMember est server-only ; headers utiles pour le contexte org, pas pour
    // autoriser la création de compte (déjà couverte par la garde + createUser).
    const member = await auth.api.addMember({
      body: {
        userId: user.id,
        role: orgRole as "owner",
        organizationId,
      },
      headers: h,
    });

    if (!member) {
      return {
        ok: false,
        message: "Membre introuvable après création.",
      };
    }

    if (formRequestedAssignment) {
      const synced = await syncMemberBranches({
        memberId: member.id,
        organizationId,
        branchIds: assignedBranchIds,
        branchRole: orgRoleToBranchRole(orgRole),
        orgRole,
        branchCycles,
      });
      if (!synced.ok) {
        return synced;
      }
    }

    if (options?.revalidateMembersPage) {
      revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    }

    return {
      ok: true,
      userId: user.id,
      memberId: member.id,
    };
  } catch (e) {
    consumeAdminCreatedUserPlainPassword(emailLower);
    if (userId) {
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
    return { ok: false, message: errMessage(e) };
  }
}

export async function updateOrganizationMemberAction(
  input: UpdateOrgMemberInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = updateOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const {
    organizationId,
    memberId,
    orgRole,
    branchIds,
    branchCycles,
    email,
    nom,
    postnom,
    prenom,
    image,
    dateOfBirth,
  } = parsed.data;
  const guard = await guardOrganizationMemberPermission(organizationId, {
    member: ["update"],
  });
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  const branches = await resolveValidBranchIds(organizationId, branchIds);
  if (!branches.ok) {
    return branches;
  }

  const h = await headers();
  try {
    await updateOrganizationMemberRole(
      {
        organizationId,
        memberId,
        role: orgRole,
        bypassBetterAuthMembership: guard.bypassed,
      },
      h,
    );
    const synced = await syncMemberBranches({
      memberId,
      organizationId,
      branchIds: branches.ids,
      branchRole: orgRoleToBranchRole(orgRole),
      orgRole,
      branchCycles,
    });
    if (!synced.ok) {
      return synced;
    }

    const memberRow = await prisma.member.findFirst({
      where: { id: memberId, organizationId },
      select: { userId: true, user: { select: { email: true } } },
    });
    if (!memberRow) {
      return { ok: false, message: "Membre introuvable." };
    }

    const emailLower = email.trim().toLowerCase();
    const taken = await prisma.user.findFirst({
      where: {
        email: emailLower,
        id: { not: memberRow.userId },
      },
      select: { id: true },
    });
    if (taken) {
      return {
        ok: false,
        message: "Cet email est déjà utilisé par un autre compte.",
      };
    }

    const imageUrl = image?.trim();
    const previousEmail = memberRow.user.email?.trim().toLowerCase() ?? "";
    await prisma.user.update({
      where: { id: memberRow.userId },
      data: {
        email: emailLower,
        ...(nom ? { name: nom.trim() } : {}),
        ...(postnom ? { postnom: postnom.trim() } : {}),
        ...(prenom ? { prenom: prenom.trim() } : {}),
        ...(imageUrl ? { image: imageUrl } : {}),
        dateOfBirth,
      },
    });
    if (previousEmail && previousEmail !== emailLower) {
      await prisma.account.updateMany({
        where: {
          userId: memberRow.userId,
          providerId: "credential",
          accountId: previousEmail,
        },
        data: { accountId: emailLower },
      });
    }

    revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    revalidatePath(
      `/admin/organizations/${organizationId}/members/${memberId}/edit`,
      "page",
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function updateUserAction(
  input: z.infer<typeof updateUserSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const {
    id,
    nom,
    postnom,
    prenom,
    dateOfBirth,
    sexe,
    telephone,
    email,
    address,
  } = parsed.data;

  try {
    const existUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existUser) {
      return { ok: false, message: "L'utilisateur n'existe pas" };
    }

    const sexeMap: Record<string, "M" | "F"> = {
      masculin: "M",
      feminin: "F",
    };

    await prisma.user.update({
      where: {
        id: id,
      },
      data: {
        name: `${nom} ${postnom} ${prenom}`,
        postnom,
        prenom,
        dateOfBirth,
        email,
        sexe: sexe ? sexeMap[sexe] : undefined,
        telephone,
        address,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function removeOrganizationMemberAction(
  input: RemoveOrgMemberInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = removeOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, memberId } = parsed.data;
  const guard = await guardOrganizationMemberPermission(organizationId, {
    member: ["delete"],
  });
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  const h = await headers();
  try {
    await removeOrganizationMember(
      {
        organizationId,
        memberIdOrEmail: memberId,
        bypassBetterAuthMembership: guard.bypassed,
      },
      h,
    );
    revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

function memberHasOwnerRole(role: string) {
  return role
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .includes(ORG_ROLE.OWNER);
}

export async function deleteOrganizationMemberPermanentlyAction(
  input: RemoveOrgMemberInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = removeOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, memberId } = parsed.data;
  const guard = await guardOrganizationMemberPermission(organizationId, {
    member: ["delete"],
  });
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId },
      select: {
        id: true,
        userId: true,
        role: true,
        branchMember: {
          select: {
            branch: { select: { name: true } },
            _count: {
              select: {
                teacher: true,
                parent: true,
                student: true,
                personel: true,
                schedule: true,
              },
            },
          },
        },
      },
    });
    if (!member) {
      return { ok: false, message: "Membre introuvable." };
    }

    if (member.userId === guard.context.userId) {
      return {
        ok: false,
        message: "Vous ne pouvez pas supprimer définitivement votre propre compte.",
      };
    }

    if (memberHasOwnerRole(member.role)) {
      const otherOwners = await prisma.member.findMany({
        where: {
          organizationId,
          id: { not: member.id },
          isArchived: false,
        },
        select: { role: true },
      });
      const hasOtherOwner = otherOwners.some((row) =>
        memberHasOwnerRole(row.role),
      );
      if (!hasOtherOwner) {
        return {
          ok: false,
          message: "Impossible de supprimer le dernier propriétaire de l’organisation.",
        };
      }
    }

    const blocked = member.branchMember.filter((row) =>
      branchMemberHasLinkedProfile(row._count),
    );
    if (blocked.length > 0) {
      const names = blocked.map((row) => row.branch.name).join(", ");
      return {
        ok: false,
        message: `Impossible de supprimer définitivement ce membre : un profil (élève, enseignant, parent ou personnel) existe encore dans : ${names}. Supprimez d’abord ces profils.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: {
          userId: member.userId,
          activeOrganizationId: organizationId,
        },
        data: {
          activeOrganizationId: null,
          activeBranchId: null,
        },
      });
      await tx.branchMember.deleteMany({
        where: { memberId: member.id },
      });
      await tx.member.delete({ where: { id: member.id } });

      const remainingMembers = await tx.member.count({
        where: { userId: member.userId },
      });
      if (remainingMembers === 0) {
        await tx.user.delete({ where: { id: member.userId } });
      }
    });

    revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function archiveOrganizationMemberAction(
  input: ArchiveOrgMemberInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = archiveOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const { organizationId, memberId, archive } = parsed.data;
  const guard = await guardOrganizationMemberPermission(organizationId, {
    member: ["update"],
  });
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId },
      select: { id: true, userId: true, isArchived: true },
    });
    if (!member) {
      return { ok: false, message: "Membre introuvable." };
    }

    if (archive && member.isArchived) {
      return { ok: false, message: "Ce membre est déjà archivé." };
    }
    if (!archive && !member.isArchived) {
      return { ok: false, message: "Ce membre est déjà actif." };
    }

    await prisma.member.update({
      where: { id: member.id },
      data: archive
        ? buildIsArchivedUpdate(guard.context.userId)
        : {
            isArchived: false,
            archivedAt: null,
            archivedById: null,
          },
    });

    if (archive) {
      await prisma.session.updateMany({
        where: {
          userId: member.userId,
          activeOrganizationId: organizationId,
        },
        data: {
          activeOrganizationId: null,
          activeBranchId: null,
        },
      });
    }

    revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export type OrganizationMemberListItem = {
  id: string;
  userId: string;
  role: string;
  isArchived: boolean;
  createdAt: Date;
  user: {
    id: string;
    email: string | null;
    name: string;
    postnom: string | null;
    prenom: string | null;
    image: string | null;
  };
  branches: { id: string; name: string }[];
};

export type OrganizationMemberDetail = {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    email: string | null;
    name: string;
    postnom: string | null;
    prenom: string | null;
    image: string | null;
    dateOfBirth: Date | null;
  };
};

export async function getOrganizationMemberAction(
  organizationId: string,
  memberId: string,
): Promise<
  | { ok: true; member: OrganizationMemberDetail }
  | { ok: false; message: string }
> {
  const guard = await guardOrganizationMemberPermission(organizationId, {
    member: ["read"],
  });
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId },
      select: {
        id: true,
        userId: true,
        role: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            postnom: true,
            prenom: true,
            image: true,
            dateOfBirth: true,
          },
        },
      },
    });
    if (!member) {
      return { ok: false, message: "Membre introuvable." };
    }
    return { ok: true, member };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export type MemberBranchOption = {
  id: string;
  name: string;
  code: string | null;
  typebranch: string;
  cycles: { value: string; label: string }[];
  isMultiCycle: boolean;
};

export async function listOrganizationActiveBranchesAction(
  organizationId: string,
): Promise<
  | { ok: true; branches: MemberBranchOption[] }
  | { ok: false; message: string }
> {
  const guard = await guardOrganizationMemberPermission(organizationId, {
    member: ["read"],
  });
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  try {
    const branches = await prisma.branch.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        typebranch: true,
        cycles: {
          where: { isActive: true },
          select: { cycle: true, sortOrder: true, isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
    return {
      ok: true,
      branches: branches.map((branch) => {
        const cycles = getBranchCycles(branch);
        return {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          typebranch: String(branch.typebranch),
          cycles: cycles.map((cycle) => ({
            value: cycle,
            label: cycleLabel(cycle),
          })),
          isMultiCycle: isMultiCycleBranch(branch),
        };
      }),
    };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function listOrganizationMemberAssignedBranchesAction(
  organizationId: string,
  memberId: string,
): Promise<
  | { ok: true; branchIds: string[]; branchCycles: Record<string, string[]> }
  | { ok: false; message: string }
> {
  const guard = await guardOrganizationMemberPermission(organizationId, {
    member: ["read"],
  });
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  try {
    const rows = await prisma.branchMember.findMany({
      where: {
        memberId,
        member: { organizationId },
        branch: { organizationId, isActive: true },
      },
      select: {
        branchId: true,
        memberCycles: { select: { cycle: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const branchCycles: Record<string, string[]> = {};
    for (const row of rows) {
      branchCycles[row.branchId] = row.memberCycles.map((c) =>
        normalizeCycle(c.cycle),
      );
    }
    return {
      ok: true,
      branchIds: rows.map((row) => row.branchId),
      branchCycles,
    };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function listOrganizationMembersAction(
  organizationId: string,
): Promise<
  | { ok: true; members: OrganizationMemberListItem[] }
  | { ok: false; message: string }
> {
  const guard = await guardOrganizationMemberPermission(organizationId, {
    member: ["read"],
  });
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const viewerUserId = session?.user?.id;
    const viewerMember = viewerUserId
      ? await prisma.member.findFirst({
          where: { userId: viewerUserId, organizationId },
          select: {
            id: true,
            role: true,
            userId: true,
            branchMember: {
              where: { branch: { organizationId, isActive: true } },
              select: {
                branchId: true,
                memberCycles: { select: { cycle: true } },
              },
            },
          },
        })
      : null;

    const seeAll = sessionCanViewAllDirectoryUsers(
      session,
      viewerMember?.role,
    );
    const viewerIsCaissier =
      !seeAll && isCycleGlobalRole(viewerMember?.role);

    const members = await prisma.member.findMany({
      where: { organizationId },
      select: {
        id: true,
        userId: true,
        role: true,
        isArchived: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            postnom: true,
            prenom: true,
            image: true,
          },
        },
        branchMember: {
          where: { branch: { organizationId, isActive: true } },
          select: {
            branchId: true,
            memberCycles: { select: { cycle: true } },
            branch: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ isArchived: "asc" }, { createdAt: "desc" }],
    });

    const viewerBranchIds = new Set(
      (viewerMember?.branchMember ?? []).map((row) => row.branchId),
    );
    const viewerCyclesByBranch = new Map<string, Set<Cycle>>();
    for (const row of viewerMember?.branchMember ?? []) {
      viewerCyclesByBranch.set(
        row.branchId,
        new Set(row.memberCycles.map((c) => normalizeCycle(c.cycle))),
      );
    }

    const visible = seeAll
      ? members
      : members.filter((member) => {
          if (member.userId === viewerUserId) return true;
          if (canViewAllDirectoryUsers(member.role)) return true;

          const sharedBranches = member.branchMember.filter((bm) =>
            viewerBranchIds.has(bm.branchId),
          );
          if (!sharedBranches.length) return false;

          // Même branche : caissier voit tous les users de ses branches.
          if (viewerIsCaissier) return true;

          return sharedBranches.some((bm) => {
            const viewerCycles =
              viewerCyclesByBranch.get(bm.branchId) ?? new Set();
            const targetCycles = new Set(
              bm.memberCycles.map((c) => normalizeCycle(c.cycle)),
            );
            if (viewerCycles.size === 0 && targetCycles.size === 0) {
              return true;
            }
            for (const cycle of viewerCycles) {
              if (targetCycles.has(cycle)) return true;
            }
            return false;
          });
        });

    return {
      ok: true,
      members: visible.map((member) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        isArchived: member.isArchived,
        createdAt: member.createdAt,
        user: member.user,
        branches: member.branchMember.map((row) => row.branch),
      })),
    };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

import { hashPassword } from "better-auth/crypto";

export async function resetUserPasswordAction(
  input: ResetOrgMemberPasswordInput,
): Promise<
  | { ok: true; whatsappSent: boolean; hasPhone: boolean }
  | { ok: false; message: string }
> {
  const parsed = resetOrgMemberPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const { organizationId, email: rawEmail } = parsed.data;
  const email = rawEmail.toLowerCase();

  const guard = await guardOrganizationMemberPermission(organizationId, {
    member: ["update"],
  });
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        name: true,
        telephone: true,
        members: {
          where: { organizationId },
          select: {
            id: true,
            branchMember: {
              where: {
                branch: { organizationId },
                role: { in: ["PARENT", "STUDENT", "TEACHER"] },
              },
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                branch: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return { ok: false, message: "Utilisateur introuvable" };
    }

    if (user.members.length === 0) {
      return {
        ok: false,
        message: "Cet utilisateur n'est pas membre de cette organisation.",
      };
    }

    const branchName =
      user.members[0]?.branchMember[0]?.branch?.name ?? null;

    const plainPassword = generateSecurePassword(16);
    stashAdminCreatedUserPlainPassword(email, plainPassword);

    // 🔐 Hash le mot de passe AVANT de le stocker
    const hashedPassword = await hashPassword(plainPassword);

    // Option B: Si le password est dans la table Account (Better Auth standard)
    await prisma.account.updateMany({
      where: {
        userId: user.id,
        providerId: "credential", // Important: cible uniquement email/password
      },
      data: { password: hashedPassword },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: true },
    });

    const result = await sendResetPasswordEmail({
      to: email,
      phone: user.telephone,
      name: user.name,
      temporaryPassword: plainPassword,
      branchName,
    });

    consumeAdminCreatedUserPlainPassword(email);
    return {
      ok: true as const,
      whatsappSent: result.whatsappSent,
      hasPhone: Boolean(user.telephone?.trim()),
    };
  } catch (e) {
    consumeAdminCreatedUserPlainPassword(email);
    return { ok: false, message: errMessage(e) };
  }
}
