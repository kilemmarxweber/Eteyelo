// app/class-fiches/page.tsx

import { prisma } from "@/lib/prisma";
import ClassFicheClient from "./components/ClassFicheClient";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { redirect, notFound } from "next/navigation";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canAccessTitulaireFichesArea,
  canManageOrganization,
} from "@/lib/auth/session-roles";
import {
  enforceResultsAreaAccess,
  isCursusSelfScopedRole,
  resolveScopedCursusStudent,
} from "@/lib/auth/cursus-scope";
import { usesBulletinForBranch } from "@/lib/branch-capabilities";
import {
  buildBulletinBranchContext,
  type BulletinBranchContext,
} from "@/lib/bulletin-context";

export const dynamic = "force-dynamic";

// 🔹 Typage Prisma
type ClassEnrollmentWithRelations = Prisma.ClassEnrollmentGetPayload<{
  include: {
    classe: {
      include: {
        option: true;
        teaching: {
          where: {
            titulaire: true;
          };
          include: {
            teacher: {
              include: {
                branchMember: {
                  include: {
                    member: {
                      include: {
                        user: true;
                      };
                    };
                  };
                };
              };
            };
            cours: true;
          };
        };
      };
    };
  };
}>;

export default async function ClassFichePage() {
  const { session, userId, branchId, organizationId, typebranch } =
    await requireBranchContext();

  if (!usesBulletinForBranch(typebranch)) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/results`,
    );
  }

  const role = enforceResultsAreaAccess(session);

  // Élève / parent : fiches personnelles via profil (pas la vue classe admin).
  if (isCursusSelfScopedRole(role)) {
    const scoped = await resolveScopedCursusStudent({
      role,
      userId,
      branchId,
    });
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/student/${scoped.id}`,
    );
  }

  const canManage = canManageOrganization(session);

  // Fiches classe : school admin ou enseignant titulaire uniquement (unit-06).
  if (!canAccessTitulaireFichesArea(session)) {
    notFound();
  }

  // 🔹 Fetch data
  const [classesFromDB, branch] = await Promise.all([
    prisma.classEnrollment.findMany({
      where: {
        branchId,
      },
      include: {
        classe: {
          include: {
            option: true,
            teaching: {
              where: {
                titulaire: true,
                OR: [
                  { branchId },
                  {
                    branchId: null,
                    classe: {
                      branchId,
                    },
                  },
                ],
              },
              include: {
                teacher: {
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
                cours: true,
              },
            },
          },
        },
      },
    }),
    prisma.branch.findFirst({
      where: {
        id: branchId,
        organizationId,
      },
      select: {
        name: true,
        code: true,
        adresse: true,
        province: true,
        ville: true,
        commune: true,
        pays: true,
        image: true,
        typebranch: true,
        organization: {
          select: {
            name: true,
            logo: true,
          },
        },
      },
    }),
  ]);

  if (!branch) {
    throw new Error("Branche introuvable dans cette organisation");
  }

  const branchContext: BulletinBranchContext =
    buildBulletinBranchContext(branch);

  // 🔹 Group by class ID — titulaire : uniquement ses classes (unit-10)
  const groupedMap = new Map<string, ClassEnrollmentWithRelations["classe"]>();

  classesFromDB.forEach((item) => {
    const classe = item.classe;
    if (!classe) return;

    if (!canManage) {
      const isTitulaireOfClass = (classe.teaching ?? []).some(
        (t) =>
          t.titulaire &&
          t.teacher?.branchMember?.member?.userId === userId,
      );
      if (!isTitulaireOfClass) return;
    }

    if (!groupedMap.has(classe.id)) {
      groupedMap.set(classe.id, {
        ...classe,
      });
    }
  });

  const groupedClasses = Array.from(groupedMap.values());

  // 🔹 Transform for client
  const classes = groupedClasses.map((c) => {
    const teaching = c?.teaching || [];

    return {
      id: c?.id || "N/A",
      name: c?.nameClasse || "N/A",
      codename: c?.codeClasse || "N/A",
      level: c?.level ?? null,
      optionName: c?.option?.nameOption ?? null,
      capacity: 25,
      supervisor:
        teaching[0]?.teacher?.branchMember?.member?.user?.name ?? "N/A",

      lessons: teaching.map((l) => ({
        id: l.id,
        subjectName: l.cours?.nameCours ?? "N/A",
      })),
    };
  });
  return (
    <ClassFicheClient
      isAdmin={canManage}
      classes={classes}
      branchContext={branchContext}
    />
  );
}
