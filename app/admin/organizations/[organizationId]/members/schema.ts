import { z } from "zod";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { phoneRegex } from "@/src/interfaces/User";
const orgRoleRefine = (role: string) =>
  (ALL_ORG_ROLE_SLUGS as readonly string[]).includes(role);

export const createOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
  email: z
    .string()
    .trim()
    .min(1, "L’email est requis.")
    .email("Adresse email invalide."),
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom est trop long."),
  orgRole: z.string().refine(orgRoleRefine, "Rôle d’organisation invalide."),
  postnom: z
    .string()
    .min(3, { message: "Veuillez saisir le postnom" })
    .optional(),
  prenom: z
    .string()
    .min(3, { message: "Veuillez saisir le prenom" })
    .optional(),
  dateOfBirth: z.date().optional(),
  sexe: z.string().min(4, { message: "Veuillez saisir le sexe" }).optional(),
  telephone: z.string().regex(phoneRegex, "Invalid Number!").optional(),
  address: z
    .string()
    .min(10, { message: "Veuillez saisir l'adresse" })
    .optional(),
  statusUser: z.string().optional(),
});

export const updateOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
  memberId: z.string().min(1),
  orgRole: z.string().refine(orgRoleRefine, "Rôle d’organisation invalide."),
});

export const removeOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
  memberId: z.string().min(1),
});

export type CreateOrgMemberInput = z.infer<typeof createOrgMemberSchema>;
export type UpdateOrgMemberInput = z.infer<typeof updateOrgMemberSchema>;
export type RemoveOrgMemberInput = z.infer<typeof removeOrgMemberSchema>;
