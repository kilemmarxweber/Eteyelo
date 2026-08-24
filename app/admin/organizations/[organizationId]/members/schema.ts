import { z } from "zod";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { phoneRegex } from "@/src/interfaces/User";
const orgRoleRefine = (role: string) =>
  (ALL_ORG_ROLE_SLUGS as readonly string[]).includes(role);

export const createOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
  /** Branche d’affectation — utilisée pour l’email de bienvenue. */
  branchId: z.string().min(1).optional(),
  /** Établissements autorisés (formulaire membres). `branchId` reste pour les flux métier. */
  branchIds: z.array(z.string().min(1)).optional(),
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
    .trim()
    .optional()
    .or(z.literal("")),
  prenom: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),
  dateOfBirth: z.date().optional(),
  sexe: z.string().min(4, { message: "Veuillez saisir le sexe" }).optional(),
  telephone: z
    .union([
      z.literal(""),
      z.string().trim().regex(phoneRegex, "Invalid Number!"),
    ])
    .optional(),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  statusUser: z.union([z.boolean(), z.string()]).optional(),
});

export const updateOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
  memberId: z.string().min(1),
  orgRole: z.string().refine(orgRoleRefine, "Rôle d’organisation invalide."),
  branchIds: z
    .array(z.string().min(1))
    .min(1, "Sélectionnez au moins une branche."),
});

export const removeOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
  memberId: z.string().min(1),
});

export const archiveOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
  memberId: z.string().min(1),
  archive: z.boolean(),
});

export const resetOrgMemberPasswordSchema = z.object({
  organizationId: z.string().min(1),
  email: z
    .string()
    .trim()
    .min(1, "L'email est requis.")
    .email("Adresse email invalide."),
});

export const updateUserSchema = z.object({
  id: z.string().optional(),
  nom: z.string().min(3, { message: "Veuillez saisir le nom" }),
  postnom: z.string().min(3, { message: "Veuillez saisir le postnom" }),
  prenom: z.string().min(3, { message: "Veuillez saisir le prenom" }),
  dateOfBirth: z.date(),
  sexe: z.string().min(4, { message: "Veuillez saisir le sexe" }),
  telephone: z.string().regex(phoneRegex, "Invalid Number!"),
  email: z.string().email({ message: "Veuillez saisir un email valide" }),
  address: z.string().optional(),
});

export type CreateOrgMemberInput = z.infer<typeof createOrgMemberSchema>;
export type UpdateOrgMemberInput = z.infer<typeof updateOrgMemberSchema>;
export type RemoveOrgMemberInput = z.infer<typeof removeOrgMemberSchema>;
export type ArchiveOrgMemberInput = z.infer<typeof archiveOrgMemberSchema>;
export type ResetOrgMemberPasswordInput = z.infer<
  typeof resetOrgMemberPasswordSchema
>;
