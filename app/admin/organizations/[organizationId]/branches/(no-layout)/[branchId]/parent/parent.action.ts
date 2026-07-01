"use server";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import {
  deleteParentSchema,
  IParent,
  parentSchema,
} from "@/src/interfaces/Parent";
import { createOrganizationMemberAction } from "../../../../members/actions";
import {
  consumeAdminCreatedUserPlainPassword,
  stashAdminCreatedUserPlainPassword,
} from "@/lib/admin-created-user-password";
import { generateSecurePassword } from "@/lib/generate-password";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

export async function getCurrentBranch() {
  const { branchId, organizationId, userId } = await requireBranchContext();

  return {
    branchId,
    organizationId,
    userId,
  };
}

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

export const createParentAction = action
  .input(parentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await getCurrentBranch();

    const { discount, orgRole, ...data } = input;
    const count = await prisma.parent.count();
    const emailLower = isValidEmail(data.email)
      ? data.email.toLowerCase()
      : `parent.${data.prenom.toLowerCase()}.${count + 1}@gmail.com`;
    const username = await getAvailableUsername(data.username);
    const password = generateSecurePassword(16);

    stashAdminCreatedUserPlainPassword(emailLower, password);

    let userId: string | null = null;

    try {
      // =========================
      // 1. CREATE ORGANIZATION MEMBER
      // =========================

      const result = await createOrganizationMemberAction({
        ...data,
        organizationId,
        orgRole: "parent",
        email: emailLower,
        dateOfBirth: new Date(),
      });

      if (!result.ok) {
        consumeAdminCreatedUserPlainPassword(emailLower);

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
          role: "PARENT",
        },
      });

      // =========================
      // 3. CREATE PARENT
      // =========================

      const parent = await prisma.parent.create({
        data: {
          branchMemberId: branchMember.id,
        },
      });

      // =========================
      // 4. CREATE DISCOUNT RULE
      // =========================

      await prisma.discountRule.create({
        data: {
          parentId: parent.id,
          scope: discount?.scope ?? "PARENT",
          percentage: discount?.percentage ?? 0,
          minChildren: discount?.minChildren,
          category: discount?.category,
          branchId,
        },
      });

      return {
        ok: true,
        parent,
      };
    } catch (e) {
      console.error("CREATE PARENT ERROR:", e);
      consumeAdminCreatedUserPlainPassword(emailLower);
      if (userId) {
        await prisma.user
          .delete({
            where: { id: userId },
          })
          .catch(() => {});
      }

      return {
        ok: false,
        message: errMessage(e),
      };
    }
  });

export const deleteParentAction = action
  .input(deleteParentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await getCurrentBranch();
    const parent = await prisma.parent.findFirst({
      where: {
        id: input.id,
        branchMember: {
          branchId,
          member: {
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
        students: {
          where: {
            branchMember: {
              branchId,
            },
          },
        },
        familyPayments: {
          where: {
            branchId,
          },
        },
      },
    });

    if (!parent) {
      throw new Error("Parent not found");
    }
    // ❌ BLOQUAGE SI LIÉ À DES DONNÉES IMPORTANTES
    if (parent.students.length > 0 || parent.familyPayments.length > 0) {
      return {
        success: false,
        message: "Impossible de supprimer ce parent (liens existants)",
      };
    }
    await prisma.discountRule.deleteMany({
      where: { parentId: parent.id, branchId },
    });

    const userId = parent.branchMember?.member?.user?.id;

    if (userId) {
      await prisma.user.delete({
        where: { id: userId },
      });
    } else {
      await prisma.parent.delete({
        where: { id: parent.id },
      });
    }
    return {
      success: true,
      message: "Parent supprimé avec succès",
      parentId: parent.id,
    };
  });

export const getParentsAction = action.handler(async (): Promise<IParent[]> => {
  const { branchId, organizationId } = await getCurrentBranch();
  const parents = await prisma.parent.findMany({
    where: {
      branchMember: {
        branchId,
        member: {
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
      students: {
        where: {
          branchMember: {
            branchId,
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
      },
      discountRules: {
        where: {
          branchId,
        },
      },
    },
  });

  const transformedParents: IParent[] = parents.map((parent) => {
    const user = parent.branchMember?.member?.user;

    const discount = parent.discountRules?.[0];

    return {
      id: parent.id,
      parentId: parent.id,
      memberId: parent.branchMember?.memberId ?? "",
      userId: user?.id ?? "",
      nom: user?.name || "",
      postnom: user?.postnom || "",
      prenom: user?.prenom || "",
      dateOfBirth: user?.dateOfBirth || new Date(),
      sexe: user?.sexe || "",
      email: user?.email || "",
      username: user?.username || "",
      telephone: user?.telephone || "",
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
      statusUser: user?.statusUser ?? true,
      address: user?.address || "",

      discount: discount
        ? {
            scope: discount.scope,
            percentage: discount.percentage,
            minChildren: discount.minChildren ?? 0,
            category: discount.category,
          }
        : null,

      students: parent.students.map((student) => {
        const studentUser = student.branchMember?.member?.user;

        return {
          id: student.id,
          studentId: student.id,

          memberId: student.branchMember?.memberId ?? "",
          userId: studentUser?.id ?? "",

          nom: studentUser?.name || "",
          postnom: studentUser?.postnom || "",
          prenom: studentUser?.prenom || "",
          dateOfBirth: studentUser?.dateOfBirth || new Date(),
          sexe: studentUser?.sexe || "",
          email: studentUser?.email || "",
          username: studentUser?.username || "",
          telephone: studentUser?.telephone || "",
          createdAt: student.createdAt,
          updatedAt: student.updatedAt,
          statusUser: studentUser?.statusUser ?? true,
          category: student.category,
          address: studentUser?.address || "",
        };
      }),
    };
  });

  return transformedParents;
});

export const updateParentAction = action
  .input(parentSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, organizationId } = await getCurrentBranch();
      const { parentId, discount, ...rest } = input;

      if (!parentId) throw new Error("Parent ID manquant");

      // 🔥 1. Vérifier parent + récupérer userId
      const parent = await prisma.parent.findFirst({
        where: {
          id: parentId,
          branchMember: {
            branchId,
            member: {
              organizationId,
            },
          },
        },
        include: {
          discountRules: {
            where: {
              branchId,
            },
          },
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

      if (!parent) throw new Error("Parent non trouvé");

      // 🔥 2. UPDATE USER (comme student)
      const userId = parent.branchMember?.member?.user?.id;

      if (!userId) throw new Error("User liÃ© introuvable");

      const sexeMap: Record<string, "M" | "F"> = {
        masculin: "M",
        feminin: "F",
        M: "M",
        F: "F",
      };

      await prisma.user.update({
        where: { id: userId },
        data: {
          username: rest.username,
          email: rest.email || undefined,
          name: rest.name,
          postnom: rest.postnom,
          prenom: rest.prenom,
          dateOfBirth: rest.dateOfBirth,
          sexe: rest.sexe ? sexeMap[rest.sexe] : undefined,
          telephone: rest.telephone,
          address: rest.address,
        },
      });

      // 🔥 3. GESTION DISCOUNT
      const existingDiscount = parent.discountRules?.[0];

      if (parent.branchMember?.branchId !== branchId) {
        throw new Error("Parent introuvable dans cette branche");
      }

      if (discount) {
        if (existingDiscount) {
          // ✅ UPDATE
          await prisma.discountRule.update({
            where: { id: existingDiscount.id },
            data: {
              scope: discount.scope,
              percentage: discount.percentage,
              minChildren: discount.minChildren ?? null,
              category: discount.category ?? null,
            },
          });
        } else {
          // ✅ CREATE
          await prisma.discountRule.create({
            data: {
              parentId,
              branchId,
              scope: discount.scope,
              percentage: discount.percentage,
              minChildren: discount.minChildren ?? null,
              category: discount.category ?? null,
            },
          });
        }
      }

      return parent;
    } catch (error: any) {
      console.error("UPDATE ERROR:", error);
      throw new Error(error.message);
    }
  });
