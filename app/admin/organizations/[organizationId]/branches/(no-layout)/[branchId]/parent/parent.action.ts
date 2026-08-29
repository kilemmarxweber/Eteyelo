"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
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
import {
  canManageParentRecords,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";
import { deactivatePersonInBranch, ensureActiveBranchMember } from "@/lib/branch-member-status";
import {
  buildBranchMemberDirectoryWhere,
  isCycleGlobalRole,
  sessionCanViewAllDirectoryUsers,
} from "@/lib/auth/cycle-scope";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import {
  familyExtraInfoSchema,
  familyExtraToDb,
} from "@/lib/registration-extra-info";
import { z } from "zod";

export async function getCurrentBranch() {
  const { branchId, organizationId, userId, session } =
    await requireBranchContext();

  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId,
      member: {
        userId,
        organizationId,
      },
    },
    select: { id: true, role: true },
  });

  return {
    branchId,
    organizationId,
    userId,
    session,
    branchMemberId: branchMember?.id ?? null,
    canManageParents: canManageParentRecords(session, branchMember?.role),
    canPurgePermanently: isOrganizationOwnerSession(session, branchMember?.role),
  };
}

function revalidateParentPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/parent`);
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
        branchId,
        orgRole: "parent",
        email: emailLower,
        dateOfBirth: data.dateOfBirth,
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
      // 2. CREATE / RÉACTIVER BRANCH MEMBER
      // =========================

      const branchMemberId = await ensureActiveBranchMember({
        memberId: result.memberId,
        branchId,
        role: "PARENT",
      });

      // =========================
      // 3. CREATE PARENT (si besoin)
      // =========================

      let parent = await prisma.parent.findUnique({
        where: { branchMemberId },
      });
      if (!parent) {
        parent = await prisma.parent.create({
          data: {
            branchMemberId,
          },
        });
      }

      // =========================
      // 4. CREATE DISCOUNT RULE
      // =========================

      const percentage = discount?.percentage ?? 0;
      let typeFraisId: string | null = null;
      if (percentage > 0) {
        const requestedTypeFraisId = discount?.typeFraisId?.trim() || null;
        if (!requestedTypeFraisId) {
          throw new Error("Type de frais requis pour la remise.");
        }
        const typeFrais = await prisma.typeFrais.findFirst({
          where: {
            id: requestedTypeFraisId,
            branchId,
            statusType: true,
          },
          select: { id: true },
        });
        if (!typeFrais) {
          throw new Error(
            "Type de frais de remise introuvable dans cette branche.",
          );
        }
        typeFraisId = typeFrais.id;
      }

      await prisma.discountRule.create({
        data: {
          parentId: parent.id,
          scope: discount?.scope ?? "PARENT",
          percentage,
          minChildren: discount?.minChildren,
          category: discount?.category,
          typeFraisId,
          branchId,
        },
      });

      revalidateParentPages(organizationId, branchId);
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

export const archiveParentAction = action
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
      select: {
        id: true,
        branchMemberId: true,
      },
    });

    if (!parent) {
      throw new Error("Parent introuvable");
    }

    await deactivatePersonInBranch({
      branchMemberId: parent.branchMemberId,
    });

    revalidateParentPages(organizationId, branchId);
    return {
      success: true,
      message:
        "Parent désactivé dans cette branche. L'historique est conservé.",
      parentId: parent.id,
    };
  });

/** Retire (désactive) de la branche — historique conservé, membre org intact. */
export const deleteParentPermanentlyAction = action
  .input(deleteParentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await getCurrentBranch();

    try {
      const parent = await prisma.parent.findFirst({
        where: {
          id: input.id,
          branchMember: {
            branchId,
            member: { organizationId },
          },
        },
        select: { id: true, branchMemberId: true },
      });

      if (!parent) {
        return {
          ok: false as const,
          message: "Parent introuvable",
        };
      }

      await deactivatePersonInBranch({
        branchMemberId: parent.branchMemberId,
      });
      revalidateParentPages(organizationId, branchId);
      return {
        ok: true as const,
        message:
          "Parent désactivé dans cette branche. Il reste membre de l'organisation ; l'historique est conservé.",
      };
    } catch (error: unknown) {
      return {
        ok: false as const,
        message: errMessage(error) || "Erreur lors de la désactivation du parent",
      };
    }
  });

/** @deprecated Utiliser archiveParentAction */
export const deleteParentAction = archiveParentAction;

export const getParentEnrollmentStatsAction = action.handler(async () => {
  const { branchId, organizationId } = await getCurrentBranch();

  const [totalParents, schoolYears, enrollments] = await Promise.all([
    prisma.parent.count({
      where: {
        branchMember: {
          branchId,
          member: { organizationId },
        },
      },
    }),
    prisma.schoolYear.findMany({
      where: { branchId, isArchived: false },
      orderBy: { startYear: "desc" },
      select: {
        id: true,
        nameYear: true,
        isCurrentYear: true,
      },
    }),
    prisma.classEnrollment.findMany({
      where: {
        branchId,
        student: {
          parent: {
            branchMember: {
              branchId,
              member: { organizationId },
            },
          },
        },
      },
      select: {
        schoolYearId: true,
        student: {
          select: { parentId: true },
        },
      },
    }),
  ]);

  const parentsByYear = new Map<string, Set<string>>();
  const enrollmentsByYear = new Map<string, number>();

  for (const enrollment of enrollments) {
    const yearId = enrollment.schoolYearId;
    const parentId = enrollment.student?.parentId;
    if (!parentId) continue;

    enrollmentsByYear.set(yearId, (enrollmentsByYear.get(yearId) ?? 0) + 1);

    const set = parentsByYear.get(yearId) ?? new Set<string>();
    set.add(parentId);
    parentsByYear.set(yearId, set);
  }

  const byYear = schoolYears.map((year) => ({
    yearId: year.id,
    nameYear: year.nameYear,
    isCurrentYear: year.isCurrentYear,
    parentsCount: parentsByYear.get(year.id)?.size ?? 0,
    enrollmentsCount: enrollmentsByYear.get(year.id) ?? 0,
  }));

  const current =
    byYear.find((year) => year.isCurrentYear) ?? byYear[0] ?? null;

  return {
    totalParents,
    currentYearName: current?.nameYear ?? null,
    parentsCurrentYear: current?.parentsCount ?? 0,
    enrollmentsCurrentYear: current?.enrollmentsCount ?? 0,
    byYear,
  };
});

export const getParentsAction = action.handler(async (): Promise<IParent[]> => {
  const { branchId, organizationId, userId, session, branchMemberId } =
    await getCurrentBranch();

  const orgMember = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  const seeAll = sessionCanViewAllDirectoryUsers(session, orgMember?.role);
  const seeWholeBranch = !seeAll && isCycleGlobalRole(orgMember?.role);
  const directoryWhere = await buildBranchMemberDirectoryWhere({
    viewerBranchMemberId: branchMemberId,
    seeAll,
    seeWholeBranch,
  });

  const parents = await prisma.parent.findMany({
    where: {
      branchMember: {
        AND: [
          {
            branchId,
            isActive: true,
            member: {
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
        },
      },
      students: {
        where: {
          branchMember: {
            branchId,
            isActive: true,
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
          classEnrollment: {
            where: {
              branchId,
              statusEnrollment: true,
              schoolYear: { isCurrentYear: true },
            },
            take: 1,
            include: { classe: true },
          },
        },
      },
      discountRules: {
        where: {
          branchId,
        },
        include: {
          typeFrais: { select: { id: true, nameType: true } },
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
      statusUser: parent.branchMember?.isActive ?? true,
      address: user?.address || "",
      nomMere: parent.nomMere,
      professionMere: parent.professionMere,
      tuteurNom: parent.tuteurNom,
      adresseTuteur: parent.adresseTuteur,
      provinceOrigine: parent.provinceOrigine,
      territoireOrigine: parent.territoireOrigine,
      secteurOrigine: parent.secteurOrigine,
      villageOrigine: parent.villageOrigine,

      discount: discount
        ? {
            scope: discount.scope,
            percentage: discount.percentage,
            minChildren: discount.minChildren ?? 0,
            category: discount.category,
            typeFraisId: discount.typeFraisId ?? null,
            typeFraisName: discount.typeFrais?.nameType ?? null,
          }
        : null,

      students: parent.students.map((student) => {
        const studentUser = student.branchMember?.member?.user;
        const currentEnrollment = student.classEnrollment[0];

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
          nationalite: student.nationalite,
          autreNationalite: student.autreNationalite,
          territoireAutreNationalite: student.territoireAutreNationalite,
          langue: student.langue,
          classCode: currentEnrollment?.classe?.codeClasse ?? null,
          className: currentEnrollment?.classe?.nameClasse ?? null,
        };
      }),
    };
  });

  return transformedParents;
});

export const getParentReportContextAction = action.handler(async () => {
  const { branchId, organizationId, canManageParents } =
    await getCurrentBranch();

  if (!canManageParents) {
    throw new Error("Action non autorisee");
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: schoolReportBranchSelect,
  });

  if (!branch) throw new Error("Branche active introuvable");

  return buildSchoolReportContext(branch);
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
        const percentage = discount.percentage ?? 0;
        let typeFraisId: string | null = null;
        if (percentage > 0) {
          const requestedTypeFraisId = discount.typeFraisId?.trim() || null;
          if (!requestedTypeFraisId) {
            throw new Error("Type de frais requis pour la remise.");
          }
          const typeFrais = await prisma.typeFrais.findFirst({
            where: {
              id: requestedTypeFraisId,
              branchId,
              statusType: true,
            },
            select: { id: true },
          });
          if (!typeFrais) {
            throw new Error(
              "Type de frais de remise introuvable dans cette branche.",
            );
          }
          typeFraisId = typeFrais.id;
        }

        if (existingDiscount) {
          // ✅ UPDATE
          await prisma.discountRule.update({
            where: { id: existingDiscount.id },
            data: {
              scope: discount.scope,
              percentage,
              minChildren: discount.minChildren ?? null,
              category: discount.category ?? null,
              typeFraisId,
            },
          });
        } else {
          // ✅ CREATE
          await prisma.discountRule.create({
            data: {
              parentId,
              branchId,
              scope: discount.scope,
              percentage,
              minChildren: discount.minChildren ?? null,
              category: discount.category ?? null,
              typeFraisId,
            },
          });
        }
      }

      revalidateParentPages(organizationId, branchId);
      return parent;
    } catch (error: any) {
      console.error("UPDATE ERROR:", error);
      throw new Error(error.message);
    }
  });

export const updateParentExtraInfoAction = action
  .input(
    z.object({
      parentId: z.string().min(1),
      familyExtra: familyExtraInfoSchema,
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, canManageParents } =
      await getCurrentBranch();
    if (!canManageParents) {
      return { ok: false as const, message: "Action non autorisee" };
    }

    const parent = await prisma.parent.findFirst({
      where: {
        id: input.parentId,
        branchMember: { branchId, member: { organizationId } },
      },
      select: { id: true },
    });
    if (!parent) {
      return { ok: false as const, message: "Parent introuvable." };
    }

    await prisma.parent.update({
      where: { id: parent.id },
      data: familyExtraToDb(input.familyExtra),
    });

    revalidateParentPages(organizationId, branchId);
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/student`,
    );
    return { ok: true as const, message: "Informations famille mises à jour." };
  });
