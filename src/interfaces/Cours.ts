import { z } from "zod";

export type PrimaryDomainFormValue = string;

export interface ICours {
  id: string;
  codeCours: string;
  nameCours: string;
  description: string;
  statusCours?: boolean | null;
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
