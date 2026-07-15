import { z } from "zod";

export type PrimaryDomainFormValue =
  | "LANGUES"
  | "MATH_SCIENCES_TECH"
  | "UNIVERS_SOCIAUX"
  | "ARTS"
  | "DEVELOPPEMENT";

export interface ICours {
  id: string;
  codeCours: string;
  nameCours: string;
  description: string;
  statusCours?: boolean | null;
  primaryDomain?: PrimaryDomainFormValue | null;
  primarySection?: string | null;
  domainOrder?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const primaryDomainEnum = z.enum([
  "LANGUES",
  "MATH_SCIENCES_TECH",
  "UNIVERS_SOCIAUX",
  "ARTS",
  "DEVELOPPEMENT",
]);

export const coursSchema = z.object({
  id: z.string().optional(),
  codeCours: z.string().trim().optional().or(z.literal("")),
  nameCours: z
    .string({ message: "veuillez renseigner le nom du cours" })
    .min(4, { message: "Le nom du cours doit avoir au moins 4 caracteres" }),
  description: z.string().optional(),
  /** Domaine bulletin primaire — optionnel */
  primaryDomain: primaryDomainEnum.nullable().optional(),
});
