"use server";

import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import {
  IPersonnel,
  updatePersonnelSchema,
  userSchema,
} from "@/src/interfaces/Personnel";
import z from "zod";
import { createOrganizationMemberAction } from "../../../../members/actions";
import {
  consumeAdminCreatedUserPlainPassword,
  stashAdminCreatedUserPlainPassword,
} from "@/lib/admin-created-user-password";
import { generateSecurePassword } from "@/lib/generate-password";
import { assignBranchMemberCycles } from "@/lib/auth/cycle-scope";
import {
  buildBranchMemberDirectoryWhere,
  isCycleGlobalRole,
  sessionCanViewAllDirectoryUsers,
} from "@/lib/auth/cycle-scope";
import { requireBranchContext, requireHrWriteBranchContext } from "@/lib/auth/require-branch-context";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { deactivatePersonInBranch, ensureActiveBranchMember } from "@/lib/branch-member-status";
import { revalidatePath } from "next/cache";

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

function isValidEmail(email: string | null | undefined): email is string {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getAvailableUsername(username: string): Promise<string> {
  let candidate = username;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${username}-${suffix}`;
  }

  return candidate;
}

export async function getCurrentBranch() {
  const { branchId, organizationId, userId } = await requireBranchContext();

  return {
    branchId,
    organizationId,
    userId,
  };
}

async function requirePersonnelInBranch(
  personnelId: string,
  branchId: string,
  organizationId: string,
) {
  const personnel = await prisma.personnel.findFirst({
    where: {
      id: personnelId,
      branchMember: {
        branchId,
        branch: { organizationId },
      },
    },
    include: {
      branchMember: {
        include: {
          member: true,
        },
      },
    },
  });

  if (!personnel) {
    throw new Error("Personnel introuvable dans cette branche");
  }

  return personnel;
}
// export async function getCurrentBranch() {
//   const session = await auth.api.getSession({
//     headers: await headers(),
//   });

//   console.log("SESSION BRANCH", session?.session?.activeBranchId);

//   const branch = await prisma.branch.findUnique({
//     where: {
//       id: session?.session?.activeBranchId,
//     },
//   });

//   console.log("BRANCH", branch);

//   return {
//     branchId: branch?.id,
//     organizationId: branch?.organizationId,
//   };
// }
export const createPersonnelAction = action
  .input(userSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireHrWriteBranchContext();
    const { ...data } = input;
    const count = await prisma.personnel.count();
    const emailLower = isValidEmail(data.email)
      ? data.email.toLowerCase()
      : `personnel.${data.prenom.toLowerCase()}.${count + 1}@gmail.com`;
    const username = await getAvailableUsername(data.username);
    const password = generateSecurePassword(16);
    stashAdminCreatedUserPlainPassword(emailLower, password);

    let userId: string | null = null;

    try {
      // =========================
      // 1. CREATE ORG MEMBER
      // =========================

      const result = await createOrganizationMemberAction({
        ...data,
        organizationId,
        branchId,
        email: emailLower,
        image: data.image?.trim() || undefined,
      });
      if (!result.ok) {
        return {
          ok: false,
          message: result.message,
        };
      }

      userId = result.userId;

      await prisma.user.update({
        where: { id: userId },
        data: { username },
      });

      // =========================
      // 2. CREATE / RÉACTIVER BRANCH MEMBER
      // =========================
      const branchMemberId = await ensureActiveBranchMember({
        memberId: result.memberId,
        branchId,
        role: "DIRECTOR",
      });

      await assignBranchMemberCycles({
        branchMemberId,
        branchId,
        orgRole: data.orgRole,
        cycles: data.cycles,
      });

      // =========================
      // 3. CREATE PERSONNEL (si besoin)
      // =========================
      let personnel = await prisma.personnel.findUnique({
        where: { branchMemberId },
      });
      if (!personnel) {
        personnel = await prisma.personnel.create({
          data: {
            branchMemberId,
          },
        });
      }

      return {
        ok: true,
        personnel,
      };
    } catch (e) {
      consumeAdminCreatedUserPlainPassword(emailLower);

      if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
      return {
        ok: false,
        message: errMessage(e),
      };
    }
  });

//archivePersonal — désactive dans la branche uniquement
export const archivePersonalAction = action
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input }) => {
    const { branchId } = await requireHrWriteBranchContext();

    const personnels = await prisma.personnel.findMany({
      where: {
        id: { in: input.ids },
        branchMember: { branchId },
      },
      select: {
        id: true,
        branchMemberId: true,
      },
    });

    for (const personnel of personnels) {
      await deactivatePersonInBranch({
        branchMemberId: personnel.branchMemberId,
      });
    }

    return true;
  });

/** @deprecated Utiliser archivePersonalAction */
export const deletePersonalAction = archivePersonalAction;

/** Désactive dans la branche — historique conservé, membre org intact. */
export const deletePersonnelPermanentlyAction = action
  .input(z.object({ ids: z.array(z.string()).min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireHrWriteBranchContext();

    const results: Array<{ id: string; ok: boolean; message: string }> = [];

    for (const personnelId of input.ids) {
      try {
        const personnel = await prisma.personnel.findFirst({
          where: {
            id: personnelId,
            branchMember: { branchId },
          },
          select: { id: true, branchMemberId: true },
        });

        if (!personnel) {
          results.push({
            id: personnelId,
            ok: false,
            message: "Personnel introuvable",
          });
          continue;
        }

        await deactivatePersonInBranch({
          branchMemberId: personnel.branchMemberId,
        });
        results.push({
          id: personnelId,
          ok: true,
          message:
            "Personnel désactivé dans cette branche. Historique conservé.",
        });
      } catch (error: unknown) {
        results.push({
          id: personnelId,
          ok: false,
          message: errMessage(error),
        });
      }
    }

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/personnel`,
    );

    const failed = results.filter((result) => !result.ok);
    if (failed.length === input.ids.length) {
      return {
        ok: false as const,
        message: failed[0]?.message ?? "Désactivation impossible",
        results,
      };
    }

    return {
      ok: true as const,
      message:
        failed.length === 0
          ? "Personnel désactivé dans cette branche. Il reste membre de l'organisation ; l'historique est conservé."
          : `${input.ids.length - failed.length} désactivé(s), ${failed.length} en échec.`,
      results,
    };
  });

export const updatePersonnelFullAction = action
  .input(
    z.object({
      personnelId: z.string(),
      memberId: z.string(),
      userId: z.string(),
      name: z.string(),
      postnom: z.string(),
      prenom: z.string(),
      email: z.string(),
      telephone: z.string(),
      address: z.string(),
      sexe: z.enum(["M", "F"]),
      dateOfBirth: z.date().optional(),

      orgRole: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireHrWriteBranchContext();
    const { personnelId, memberId, userId, orgRole, ...userData } = input;

    const personnel = await requirePersonnelInBranch(
      personnelId,
      branchId,
      organizationId,
    );

    if (
      personnel.branchMember?.member?.id !== memberId ||
      personnel.branchMember?.member?.userId !== userId
    ) {
      throw new Error("Personnel introuvable dans cette branche");
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. UPDATE USER
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          name: userData.name,
          postnom: userData.postnom,
          prenom: userData.prenom,
          email: userData.email,
          telephone: userData.telephone,
          address: userData.address,
          sexe: userData.sexe,
          dateOfBirth: userData.dateOfBirth,
        },
      });

      // 2. UPDATE MEMBER ROLE (comme ton EditMemberForm)
      const member = await tx.member.update({
        where: { id: memberId },
        data: {
          role: orgRole,
        },
      });

      // 3. UPDATE PERSONNEL (si tu veux tracer update)
      const personnel = await tx.personnel.update({
        where: { id: personnelId },
        data: {},
      });

      return { user, member, personnel };
    });

    return result;
  });

export const getPersonnelPresenceStatsAction = action.handler(async () => {
  const { branchId, organizationId } = await getCurrentBranch();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const [totalExpected, present] = await Promise.all([
    prisma.personnel.count({
      where: {
        branchMember: {
          branchId,
          branch: { organizationId },
        },
      },
    }),
    prisma.personnelAttendance.count({
      where: {
        branchId,
        date: { gte: start, lte: end },
        status: { in: ["PRESENT", "LATE"] },
      },
    }),
  ]);

  return { present, totalExpected };
});

export const getPersonnelsAction = action.handler(
  async (): Promise<IPersonnel[]> => {
    const { branchId, organizationId, userId, session } =
      await requireBranchContext();

    const [orgMember, branchMember] = await Promise.all([
      prisma.member.findFirst({
        where: { userId, organizationId },
        select: { role: true },
      }),
      prisma.branchMember.findFirst({
        where: { branchId, member: { userId, organizationId } },
        select: { id: true },
      }),
    ]);

    const seeAll = sessionCanViewAllDirectoryUsers(session, orgMember?.role);
    const seeWholeBranch =
      !seeAll && isCycleGlobalRole(orgMember?.role);
    const directoryWhere = await buildBranchMemberDirectoryWhere({
      viewerBranchMemberId: branchMember?.id ?? null,
      seeAll,
      seeWholeBranch,
    });

    const personnels = await prisma.personnel.findMany({
      where: {
        branchMember: {
          AND: [
            {
              branchId,
              isActive: true,
              branch: {
                organizationId,
              },
            },
            ...(directoryWhere ? [directoryWhere] : []),
          ],
        },
      },
      include: {
        branchMember: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
            memberCycles: { select: { cycle: true } },
          },
        },
      },
    });

    return personnels.map((personnel) => {
      const member = personnel.branchMember?.member;
      const user = member?.user;

      return {
        // 🔥 IDs essentiels pour update
        id: personnel.id, // ✅ IMPORTANT
        personnelId: personnel.id,
        memberId: member?.id ?? "",
        userId: user?.id ?? "",

        // data user
        nom: user?.name ?? "",
        postnom: user?.postnom ?? "",
        prenom: user?.prenom ?? "",
        dateOfBirth: user?.dateOfBirth ?? new Date(),
        sexe: user?.sexe ?? "",
        email: user?.email ?? "",
        username: user?.username ?? "",
        telephone: user?.telephone ?? "",
        address: user?.address ?? "",
        image: user?.image ?? "",
        statusUser: personnel.branchMember?.isActive ?? true,

        // metadata
        createdAt: personnel.createdAt,
        updatedAt: personnel.updatedAt,
        statusPersonnal: true,

        // role org
        role: member?.role ?? "",
        cycles: (personnel.branchMember?.memberCycles ?? []).map(
          (row) => row.cycle,
        ),
      };
    });
  },
);

export const updatePersonnelAction = action
  .input(updatePersonnelSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireHrWriteBranchContext();
    const { orgRole, ...data } = input;

    if (!input.personnelId) {
      throw new Error("Personnel introuvable");
    }

    const personnel = await requirePersonnelInBranch(
      input.personnelId,
      branchId,
      organizationId,
    );

    const memberId = personnel.branchMember?.member?.id;

    if (!memberId) {
      throw new Error("Membre introuvable");
    }

    const result = await prisma.$transaction(async (tx) => {
      // =========================
      // UPDATE USER
      // =========================
      const user = await tx.user.update({
        where: {
          id: personnel.branchMember?.member.userId,
        },
        data: {
          name: data.name,
          postnom: data.postnom,
          prenom: data.prenom,
          email: data.email,
          telephone: data.telephone,
          address: data.address,
          sexe: data.sexe === "masculin" ? "M" : "F",
          dateOfBirth: data.dateOfBirth,
          ...(data.image?.trim() ? { image: data.image.trim() } : {}),
        },
      });

      // =========================
      // UPDATE MEMBER ROLE
      // =========================
      const member = await tx.member.update({
        where: {
          id: memberId,
        },
        data: {
          role: orgRole,
        },
      });

      return {
        user,
        member,
      };
    });

    const branchMemberId = personnel.branchMember?.id;
    if (branchMemberId) {
      await assignBranchMemberCycles({
        branchMemberId,
        branchId,
        orgRole,
        cycles: data.cycles,
      });
    }

    return result;
  });

export const getPersonnelReportContextAction = action.handler(async () => {
  const { branchId, organizationId } = await getCurrentBranch();

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: schoolReportBranchSelect,
  });

  if (!branch) throw new Error("Branche active introuvable");

  return buildSchoolReportContext(branch);
});
