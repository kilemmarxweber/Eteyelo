"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/prisma/generated/prisma/client";

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
    telephone: z.string().trim().optional(),
    provenanceEcole: z.string().trim().optional(),
  }),
  guardians: z.array(guardianSchema).min(1).max(2),
  requestedLevel: z.string().trim().min(1, "Classe ou niveau souhaite requis"),
  requestedSection: z.string().trim().optional(),
  requestedOption: z.string().trim().optional(),
  photoUrl: z.string().trim().optional(),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "Le consentement est obligatoire" }),
  }),
});

export type OnlineRegistrationInput = z.infer<typeof onlineRegistrationSchema>;

export async function getActiveBranches() {
  return prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, ville: true, pays: true, image: true },
  });
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

  const reference = createReference();
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "RegistrationRequest" (
      "id", "reference", "branchId", "organizationId", "schoolYearId", "status",
      "studentData", "guardiansData", "requestedLevel", "requestedSection",
      "requestedOption", "photoUrl", "consentAccepted", "createdAt", "updatedAt"
    ) VALUES (
      ${crypto.randomUUID()}, ${reference}, ${branch.id}, ${branch.organizationId}, ${branch.schoolYear[0]?.id ?? null},
      'PENDING'::"RegistrationRequestStatus", ${JSON.stringify(data.student)}::jsonb,
      ${JSON.stringify(data.guardians)}::jsonb, ${data.requestedLevel}, ${data.requestedSection || null},
      ${data.requestedOption || null}, ${data.photoUrl || null}, ${data.consentAccepted}, NOW(), NOW()
    )
  `);

  return {
    success: true as const,
    message: "Votre demande a ete envoyee et doit etre confirmee par l'ecole.",
    reference,
  };
}
