import { z } from "zod";

export type PrimaryDomainFormValue = string;

export type CoursKindValue = "SUBJECT" | "SCHEDULE_COMPONENT";

export interface ICours {
  id: string;
  codeCours: string;
  nameCours: string;
  description: string;
  statusCours?: boolean | null;
  kind?: CoursKindValue;
  parentCoursId?: string | null;
  sortOrder?: number;
  parentNameCours?: string | null;
  componentsCount?: number;
  primaryDomain?: PrimaryDomainFormValue | null;
  primarySection?: string | null;
  domainOrder?: number | null;
  teachingsCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const coursSchema = z.object({
  id: z.string().optional(),
  codeCours: z.string().trim().optional().or(z.literal("")),
  nameCours: z
    .string({ message: "veuillez renseigner le nom du cours" })
    .min(4, { message: "Le nom du cours doit avoir au moins 4 caracteres" }),
  description: z.string().optional(),
  /** Domaine bulletin primaire — optionnel */
  primaryDomain: z.string().trim().min(2).max(40).nullable().optional(),
});

export const coursComponentSchema = z.object({
  id: z.string().optional(),
  parentCoursId: z.string().min(1, "Cours parent requis"),
  nameCours: z
    .string({ message: "Nom du poste requis" })
    .trim()
    .min(2, { message: "Au moins 2 caractères" })
    .max(80),
  codeCours: z.string().trim().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  statusCours: z.boolean().optional(),
});
