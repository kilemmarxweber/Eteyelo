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
import { requireBranchContext } from "@/lib/auth/require-branch-context";

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
    const { branchId, organizationId } = await getCurrentBranch();
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
        email: emailLower,
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
      // 2. CREATE BRANCH MEMBER
      // =========================
      const branchMember = await prisma.branchMember.create({
        data: {
          memberId: result.memberId,
          branchId,
          role: "DIRECTOR", // ou "PERSONNEL"
        },
      });

      // =========================
      // 3. CREATE PERSONNEL
      // =========================
      const personnel = await prisma.personnel.create({
        data: {
          branchMemberId: branchMember.id,
        },
      });

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

//archivePersonal
export const archivePersonalAction = action
  .input(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await getCurrentBranch();

    const personnels = await prisma.personnel.findMany({
      where: {
        id: { in: input.ids },
        branchMember: { branchId },
      },
      include: {
        branchMember: {
          include: {
            member: {
              include: { user: true },
            },
          },
        },
      },
    });

    for (const personnel of personnels) {
      const userId = personnel.branchMember?.member?.user?.id;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { statusUser: false },
        });
      }
    }

    return true;
  });

/** @deprecated Utiliser archivePersonalAction */
export const deletePersonalAction = archivePersonalAction;

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
    const { branchId, organizationId } = await requireBranchContext();
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
    const { branchId, organizationId } = await getCurrentBranch();
    const personnels = await prisma.personnel.findMany({
      where: {
        branchMember: {
          branchId,
          branch: {
            organizationId,
          },
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
        statusUser: user?.statusUser ?? true,

        // metadata
        createdAt: personnel.createdAt,
        updatedAt: personnel.updatedAt,
        statusPersonnal: true,

        // role org
        role: member?.role ?? "",
      };
    });
  },
);

export const updatePersonnelAction = action
  .input(updatePersonnelSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
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

    return result;
  });
