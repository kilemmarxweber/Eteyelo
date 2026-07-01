// app/class-fiches/page.tsx

import { prisma } from "@/lib/prisma";
import ClassFicheClient from "./components/ClassFicheClient";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canManageOrganization } from "@/lib/auth/session-roles";

// 🔹 Typage Prisma
type ClassEnrollmentWithRelations = Prisma.ClassEnrollmentGetPayload<{
  include: {
    classe: {
      include: {
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
  const { session, branchId } = await requireBranchContext();
  const canManage = canManageOrganization(session);

  // 🔹 Fetch data
  const classesFromDB: ClassEnrollmentWithRelations[] =
    await prisma.classEnrollment.findMany({
      where: {
        branchId,
      },
      include: {
        classe: {
          include: {
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
    });

  // 🔹 Group by class ID
  const groupedMap = new Map<string, ClassEnrollmentWithRelations["classe"]>();

  classesFromDB.forEach((item) => {
    const classe = item.classe;
    if (!classe) return;

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
      capacity: 25,
      supervisor:
        teaching[0]?.teacher?.branchMember?.member?.user?.name ?? "N/A",

      lessons: teaching.map((l) => ({
        id: l.id,
        subjectName: l.cours?.nameCours ?? "N/A",
      })),
    };
  });
  return <ClassFicheClient isAdmin={canManage} classes={classes} />;
}
