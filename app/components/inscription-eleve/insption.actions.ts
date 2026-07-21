"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isPrimaryBranch } from "@/lib/class-structure";
import { isAtelierBranch, isCentreFormationBranch } from "@/lib/branch-capabilities";
import { fetchPublishedBranchRegistrationInfo } from "@/lib/fetch-published-branch-registration-info";

const PRIMARY_MIN_AGE = 5;

const guardianSchema = z.object({
  name: z.string().trim().min(2, "Nom du responsable requis"),
  postnom: z.string().trim().min(2, "Postnom du responsable requis"),
  prenom: z.string().trim().min(2, "Prenom du responsable requis"),
  relationship: z.string().trim().min(1, "Lien de parente requis"),
  sexe: z.enum(["masculin", "feminin"]),
  telephone: z.string().trim().min(7, "Telephone du responsable requis"),
  email: z.string().trim().email("Email du responsable invalide").optional().or(z.literal("")),
  address: z.string().trim().min(5, "Adresse du responsable requise"),
  isPrimary: z.boolean(),
});

const onlineRegistrationSchema = z.object({
  branchId: z.string().min(1, "Ecole requise"),
  student: z.object({
    name: z.string().trim().min(2, "Nom de l'eleve requis"),
    postnom: z.string().trim().min(2, "Postnom de l'eleve requis"),
    prenom: z.string().trim().min(2, "Prenom de l'eleve requis"),
    sexe: z.enum(["masculin", "feminin"]),
    dateOfBirth: z.string().min(1, "Date de naissance requise"),
    placeOfBirth: z.string().trim().min(2, "Lieu de naissance requis"),
    address: z.string().trim().min(5, "Adresse de l'eleve requise"),
    email: z.string().trim().email().optional().or(z.literal("")),
    provenanceEcole: z.string().trim().optional(),
  }),
  guardians: z.array(guardianSchema).max(2),
  requestedLevel: z.string().trim().min(1, "Classe ou niveau souhaite requis"),
  requestedSection: z.string().trim().optional(),
  requestedOption: z.string().trim().optional(),
  photoUrl: z.string().trim().optional(),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "Le consentement est obligatoire" }),
  }),
  termsInfoId: z.string().optional().nullable(),
});

export type OnlineRegistrationInput = z.infer<typeof onlineRegistrationSchema>;

function ageFromDate(dateStr: string) {
  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export async function getActiveBranches() {
  return prisma.branch.findMany({
    where: {
      isActive: true,
      typebranch: { not: "ATELIER" },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      ville: true,
      pays: true,
      image: true,
      typebranch: true,
    },
  });
}

export async function getPublishedBranchRegistrationInfo(branchId: string) {
  return fetchPublishedBranchRegistrationInfo(branchId);
}

export type PublicAcademicChoiceSection = {
  id: string;
  codeSection: string;
  nameSection: string;
  options: {
    id: string;
    codeOption: string;
    nameOption: string;
  }[];
};

export async function getPublicRegistrationAcademicChoices(branchId: string) {
  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      isActive: true,
      typebranch: { not: "ATELIER" },
    },
    select: { typebranch: true },
  });

  if (!branch || !["CENTRE_FORMATION", "UNIVERSITE"].includes(branch.typebranch)) {
    return null;
  }

  const [sections, options] = await Promise.all([
    prisma.section.findMany({
      where: { branchId, statusSection: true },
      orderBy: { nameSection: "asc" },
      select: { id: true, codeSection: true, nameSection: true },
    }),
    prisma.option.findMany({
      where: { branchId, statusOption: true },
      orderBy: { nameOption: "asc" },
      select: {
        id: true,
        codeOption: true,
        nameOption: true,
        sectionId: true,
      },
    }),
  ]);

  const tree: PublicAcademicChoiceSection[] = sections.map((section) => ({
    ...section,
    options: options
      .filter((option) => option.sectionId === section.id)
      .map(({ id, codeOption, nameOption }) => ({
        id,
        codeOption,
        nameOption,
      })),
  }));

  return {
    typebranch: branch.typebranch,
    sections: tree,
  };
}

function createReference() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `INS-${stamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function registerStudentOnline(raw: OnlineRegistrationInput) {
  const parsed = onlineRegistrationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Formulaire invalide",
    };
  }

  const data = parsed.data;
  const branch = await prisma.branch.findFirst({
    where: { id: data.branchId, isActive: true },
    select: {
      id: true,
      organizationId: true,
      typebranch: true,
      schoolYear: {
        where: { isCurrentYear: true, isArchived: false },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!branch) {
    return { success: false as const, message: "Ecole introuvable." };
  }

  if (isAtelierBranch(branch.typebranch)) {
    return {
      success: false as const,
      message:
        "Les inscriptions en ligne ne sont pas disponibles pour les ateliers.",
    };
  }

  if (
    !isCentreFormationBranch(branch.typebranch) &&
    data.guardians.length < 1
  ) {
    return {
      success: false as const,
      message: "Au moins un responsable est requis.",
    };
  }

  if (isPrimaryBranch(branch.typebranch)) {
    const age = ageFromDate(data.student.dateOfBirth);
    if (age === null || age < PRIMARY_MIN_AGE) {
      return {
        success: false as const,
        message: `Pour le primaire, l'enfant doit avoir au moins ${PRIMARY_MIN_AGE} ans.`,
      };
    }
  }

  const reference = createReference();
  const publishedInfo = data.termsInfoId
    ? await prisma.branchRegistrationInfo.findFirst({
        where: {
          id: data.termsInfoId,
          branchId: branch.id,
          isPublished: true,
        },
        select: { id: true },
      })
    : null;

  await prisma.registrationRequest.create({
    data: {
      reference,
      branchId: branch.id,
      organizationId: branch.organizationId,
      schoolYearId: branch.schoolYear[0]?.id ?? null,
      status: "PENDING",
      studentData: data.student,
      guardiansData: data.guardians,
      requestedLevel: data.requestedLevel,
      requestedSection: data.requestedSection || null,
      requestedOption: data.requestedOption || null,
      photoUrl: data.photoUrl || null,
      consentAccepted: true,
      termsAcceptedAt: publishedInfo ? new Date() : null,
      termsInfoId: publishedInfo?.id ?? null,
    },
  });

  return {
    success: true as const,
    message: "Votre demande a ete envoyee et doit etre confirmee par l'ecole.",
    reference,
  };
}
