"use server";

import { z } from "zod";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { isPrimaryBranch } from "@/lib/branch-capabilities";
import {
  emptyExamExportMeta,
  examExportMetaSchema,
  isPrimaryFinalistClass,
  parseExamExportMeta,
} from "@/lib/exam-export-meta";
import { branchDocumentName } from "@/lib/branch-document-name";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import type { Prisma } from "@/prisma/generated/prisma/client";

function formatFullName(
  name?: string | null,
  postnom?: string | null,
  prenom?: string | null,
) {
  return [name, postnom, prenom].filter(Boolean).join(" ").trim();
}

function formatBirthDate(value?: Date | null) {
  if (!value) return "";
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  return `LE ${day}/${month}/${year}`;
}

function normalizeSexe(value?: string | null) {
  const raw = value?.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = raw?.toLowerCase();
  if (lower === "m" || lower === "masculin") return "M";
  if (lower === "f" || lower === "feminin") return "F";
  return value?.trim().slice(0, 1).toUpperCase() || "";
}

function sessionFromYear(nameYear: string, endYear?: Date | null) {
  const fromName = nameYear.match(/(20\d{2})/g);
  if (fromName?.length) return fromName[fromName.length - 1];
  if (endYear) return String(endYear.getFullYear());
  return nameYear;
}

export const getFinalistesWorkspaceAction = action.handler(async () => {
  const { branchId, organizationId, session, typebranch } =
    await requireBranchContext();

  if (!isPrimaryBranch(typebranch)) {
    throw new Error("Réservé aux branches primaire.");
  }

  const canManage = canManageOrganization(session);

  const [branch, schoolYears, classes] = await Promise.all([
    prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: {
        name: true,
        description: true,
        code: true,
        province: true,
        ville: true,
        commune: true,
        examExportMeta: true,
      },
    }),
    prisma.schoolYear.findMany({
      where: { branchId, isArchived: false },
      orderBy: { startYear: "desc" },
      select: {
        id: true,
        nameYear: true,
        isCurrentYear: true,
        endYear: true,
      },
    }),
    prisma.classe.findMany({
      where: {
        branchId,
        OR: [{ statusClasse: true }, { statusClasse: null }],
      },
      select: {
        id: true,
        nameClasse: true,
        codeClasse: true,
        level: true,
      },
      orderBy: { nameClasse: "asc" },
    }),
  ]);

  if (!branch) throw new Error("Branche introuvable");

  const finalistClasses = classes.filter(isPrimaryFinalistClass);
  const meta = parseExamExportMeta(branch.examExportMeta);
  if (!meta.etablissement) meta.etablissement = branchDocumentName(branch);
  if (!meta.etablissementCode && branch.code) {
    meta.etablissementCode = branch.code;
  }
  if (!meta.province && branch.province) meta.province = branch.province;
  if (!meta.centre && branch.ville) meta.centre = branch.ville;

  return {
    canManage,
    branchName: branchDocumentName(branch),
    schoolYears,
    classes: finalistClasses,
    meta: { ...emptyExamExportMeta(), ...meta },
  };
});

const listFinalistesSchema = z.object({
  schoolYearId: z.string().min(1),
  classeId: z.string().min(1).optional().or(z.literal("")),
});

export const listFinalistesAction = action
  .input(listFinalistesSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } =
      await requireBranchContext();

    if (!isPrimaryBranch(typebranch)) {
      throw new Error("Réservé aux branches primaire.");
    }

    const schoolYear = await prisma.schoolYear.findFirst({
      where: { id: input.schoolYearId, branchId },
      select: { id: true, nameYear: true, endYear: true },
    });
    if (!schoolYear) throw new Error("Année scolaire introuvable");

    const [finalistClasses, branch] = await Promise.all([
      prisma.classe.findMany({
        where: {
          branchId,
          OR: [{ statusClasse: true }, { statusClasse: null }],
        },
        select: {
          id: true,
          nameClasse: true,
          codeClasse: true,
          level: true,
        },
      }),
      prisma.branch.findFirst({
        where: { id: branchId, organizationId },
        select: { ville: true, commune: true, name: true },
      }),
    ]);
    const allowedIds = new Set(
      finalistClasses.filter(isPrimaryFinalistClass).map((item) => item.id),
    );
    if (!allowedIds.size) {
      return {
        session: sessionFromYear(schoolYear.nameYear, schoolYear.endYear),
        schoolYearName: schoolYear.nameYear,
        classLabel: "Aucune classe 6è",
        rows: [] as Array<Record<string, string | number>>,
      };
    }

    const classeFilter =
      input.classeId && allowedIds.has(input.classeId)
        ? { classeId: input.classeId }
        : { classeId: { in: [...allowedIds] } };

    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        branchId,
        schoolYearId: schoolYear.id,
        statusEnrollment: true,
        ...classeFilter,
      },
      include: {
        classe: {
          select: { nameClasse: true, codeClasse: true },
        },
        student: {
          select: {
            placeOfBirth: true,
            nationalite: true,
            provenanceEcole: true,
            branchMember: {
              select: {
                member: {
                  select: {
                    user: {
                      select: {
                        name: true,
                        postnom: true,
                        prenom: true,
                        dateOfBirth: true,
                        sexe: true,
                        username: true,
                        address: true,
                        statusUser: true,
                      },
                    },
                  },
                },
              },
            },
            parent: {
              select: {
                nomMere: true,
                villageOrigine: true,
                secteurOrigine: true,
                territoireOrigine: true,
                provinceOrigine: true,
                branchMember: {
                  select: {
                    member: {
                      select: {
                        user: {
                          select: {
                            name: true,
                            postnom: true,
                            prenom: true,
                            address: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    enrollments.sort((a, b) => {
      const classA = a.classe?.nameClasse ?? "";
      const classB = b.classe?.nameClasse ?? "";
      if (classA !== classB) return classA.localeCompare(classB, "fr");
      const nameA = a.student?.branchMember?.member?.user?.name ?? "";
      const nameB = b.student?.branchMember?.member?.user?.name ?? "";
      return nameA.localeCompare(nameB, "fr");
    });

    const selectedClass = input.classeId
      ? finalistClasses.find((item) => item.id === input.classeId)
      : null;

    const rows = enrollments
      .filter((item) => item.student?.branchMember?.member?.user?.statusUser !== false)
      .map((item, index) => {
        const user = item.student?.branchMember?.member?.user;
        const parentUser = item.student?.parent?.branchMember?.member?.user;
        const parent = item.student?.parent;

        return {
          numero: index + 1,
          matricule: user?.username ?? "",
          fullName: formatFullName(user?.name, user?.postnom, user?.prenom),
          placeOfBirth: item.student?.placeOfBirth ?? "",
          dateOfBirth: formatBirthDate(user?.dateOfBirth ?? null),
          sexe: normalizeSexe(user?.sexe),
          e13: item.e13 ?? "",
          e80: item.e80 ?? "",
          fatherName: formatFullName(
            parentUser?.name,
            parentUser?.postnom,
            parentUser?.prenom,
          ),
          motherName: parent?.nomMere ?? "",
          nationalite: item.student?.nationalite ?? "",
          avenue:
            user?.address?.trim() ||
            parent?.villageOrigine ||
            parentUser?.address ||
            "",
          numeroAdresse: "S/N",
          quartier: parent?.secteurOrigine ?? "",
          commune:
            parent?.territoireOrigine || branch?.commune || branch?.ville || "",
          ville: branch?.ville || parent?.provinceOrigine || "",
          annee: sessionFromYear(schoolYear.nameYear, schoolYear.endYear),
          ecole:
            item.student?.provenanceEcole?.trim() ||
            branch?.name?.slice(0, 24) ||
            "",
          className: item.classe?.nameClasse ?? "",
        };
      });

    return {
      session: sessionFromYear(schoolYear.nameYear, schoolYear.endYear),
      schoolYearName: schoolYear.nameYear,
      classLabel: selectedClass
        ? selectedClass.nameClasse
        : `Toutes les classes 6è (${allowedIds.size})`,
      rows,
    };
  });

export const saveExamExportMetaAction = action
  .input(examExportMetaSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, typebranch } =
      await requireBranchContext();

    if (!isPrimaryBranch(typebranch)) {
      throw new Error("Réservé aux branches primaire.");
    }
    if (!canManageOrganization(session)) {
      throw new Error("Permission insuffisante.");
    }

    await prisma.branch.update({
      where: { id: branchId },
      data: { examExportMeta: input as Prisma.InputJsonValue },
    });

    return { ok: true as const, meta: input };
  });
