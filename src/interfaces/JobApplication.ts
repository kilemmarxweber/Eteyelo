import { z } from "zod";
import { ORG_ROLE } from "@/lib/permissions";

export const PUBLIC_PERSONNEL_ROLE_SLUGS = [
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.MONITEUR,
  ORG_ROLE.RESPONSABLE,
  ORG_ROLE.SURVEILLANT,
  ORG_ROLE.SUPPORT,
] as const;

export const jobApplicationInputSchema = z
  .object({
    branchId: z.string().min(1, "Veuillez choisir un établissement"),
    applicationType: z.enum(["TEACHER", "PERSONNEL"], {
      required_error: "Veuillez choisir le type de candidature",
    }),
    nom: z.string().trim().min(2, "Nom requis"),
    postnom: z.string().trim().min(2, "Postnom requis"),
    prenom: z.string().trim().min(2, "Prénom requis"),
    sexe: z.enum(["masculin", "feminin"], {
      required_error: "Sexe requis",
    }),
    dateOfBirth: z.string().min(1, "Date de naissance requise"),
    telephone: z.string().trim().min(7, "Téléphone requis"),
    email: z.string().trim().email("Email invalide"),
    address: z.string().trim().min(10, "Adresse requise"),
    photoUrl: z.string().trim().optional(),
    desiredSubjects: z.string().trim().optional(),
    desiredLevels: z.string().trim().optional(),
    yearsOfExperience: z.coerce.number().int().min(0).optional(),
    desiredOrgRole: z.string().trim().optional(),
    experienceSummary: z.string().trim().optional(),
    educationSummary: z.string().trim().optional(),
    skills: z.string().trim().optional(),
    availability: z.string().trim().optional(),
    motivation: z.string().trim().optional(),
    cvUrl: z.string().trim().min(1, "CV requis"),
    coverLetterUrl: z.string().trim().min(1, "Lettre de motivation requise"),
    consentAccepted: z.literal(true, {
      errorMap: () => ({ message: "Le consentement est obligatoire" }),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.applicationType === "TEACHER") {
      if (!data.desiredSubjects?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Matières souhaitées requises",
          path: ["desiredSubjects"],
        });
      }
      if (!data.desiredLevels?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Niveaux souhaités requis",
          path: ["desiredLevels"],
        });
      }
    }

    if (data.applicationType === "PERSONNEL") {
      if (!data.desiredOrgRole?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rôle souhaité requis",
          path: ["desiredOrgRole"],
        });
      } else if (
        !PUBLIC_PERSONNEL_ROLE_SLUGS.includes(
          data.desiredOrgRole as (typeof PUBLIC_PERSONNEL_ROLE_SLUGS)[number],
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rôle personnel invalide",
          path: ["desiredOrgRole"],
        });
      }
    }
  });

export type JobApplicationInput = z.infer<typeof jobApplicationInputSchema>;

export type JobApplicationListItem = {
  id: string;
  reference: string;
  status: string;
  applicationType: string;
  nom: string;
  postnom: string;
  prenom: string;
  email: string;
  telephone: string;
  desiredSubjects: string | null;
  desiredLevels: string | null;
  desiredOrgRole: string | null;
  yearsOfExperience: number | null;
  cvUrl: string;
  coverLetterUrl: string;
  photoUrl: string | null;
  createdAt: Date;
};
