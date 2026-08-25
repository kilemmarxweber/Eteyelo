// app/class-fiches/page.tsx

import { prisma } from "@/lib/prisma";
import ClassFicheClient from "./components/ClassFicheClient";
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
import { anyCycle, isPrimaryLikeCycle } from "@/lib/cycle";
import {
  buildBulletinBranchContext,
  type BulletinBranchContext,
} from "@/lib/bulletin-context";
import { getBranchDirectorForBulletin } from "@/lib/actions";
import { getSchoolYearForBranch } from "@/lib/school-year";

export const dynamic = "force-dynamic";

export default async function ClassFichePage() {
  const { session, userId, branchId, organizationId, typebranch, cycles } =
    await requireBranchContext();

  if (!anyCycle(cycles, usesBulletinForBranch)) {
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

  // 🔹 Fetch data (classes distinctes, année courante — pas toutes les inscriptions)
  const currentYear = await getSchoolYearForBranch(branchId);

  const [classesFromDB, branch] = await Promise.all([
    prisma.classe.findMany({
      where: {
        branchId,
        ...(currentYear
          ? {
              classEnrollment: {
                some: {
                  branchId,
                  schoolYearId: currentYear.id,
                  statusEnrollment: true,
                },
              },
            }
          : {}),
      },
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
                        user: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
            cours: { select: { nameCours: true } },
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
        description: true,
        code: true,
        adresse: true,
        province: true,
        ville: true,
        commune: true,
        pays: true,
        image: true,
        typebranch: true,
        educationSystem: true,
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

  const director = await getBranchDirectorForBulletin();
  branchContext.directorName = director.directorName;
  branchContext.directorTitle = director.directorTitle;

  if (anyCycle(cycles, isPrimaryLikeCycle)) {
    const { listBranchPrimaryDomains } = await import(
      "@/lib/branch-primary-domains"
    );
    branchContext.primaryDomains = await listBranchPrimaryDomains(branchId);
  }

  // 🔹 Filtrer titulaire : uniquement ses classes (unit-10)
  const groupedClasses = classesFromDB.filter((classe) => {
    if (canManage) return true;

    return (classe.teaching ?? []).some(
      (t) =>
        t.titulaire &&
        t.teacher?.branchMember?.member?.userId === userId,
    );
  });

  // 🔹 Transform for client
  const classes = groupedClasses.map((c) => {
    const teaching = c.teaching || [];

    return {
      id: c.id,
      name: c.nameClasse || "N/A",
      codename: c.codeClasse || "N/A",
      cycle: c.cycle ?? null,
      level: c.level ?? null,
      optionName: c.option?.nameOption ?? null,
      parallel: c.parallel ?? null,
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
