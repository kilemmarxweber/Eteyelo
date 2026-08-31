import { z } from "zod";
import { memberHasImplicitAllBranchAccess } from "@/lib/auth/role-labels";
import { phoneRegex } from "@/src/interfaces/User";

const orgRoleRefine = (role: string) => /^[a-z][a-z0-9_]*$/.test(role.trim());

const namePart = z
  .string()
  .trim()
  .min(2, "Au moins 2 caractères.")
  .max(80, "Trop long.");

/** Cycles choisis par établissement (branchId → cycle values). */
const branchCyclesSchema = z
  .record(z.string().min(1), z.array(z.string().min(1)))
  .optional();

export const createOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
  /** Branche d’affectation — utilisée pour l’email de bienvenue. */
  branchId: z.string().min(1).optional(),
  /** Établissements autorisés (formulaire membres). `branchId` reste pour les flux métier. */
  branchIds: z.array(z.string().min(1)).optional(),
  /** Cycles d’affectation par branche (requis en multi-cycle si rôle non transverse). */
  branchCycles: branchCyclesSchema,
  email: z
    .string()
    .trim()
    .min(1, "L’email est requis.")
    .email("Adresse email invalide."),
  /** Nom de famille (comme pour un élève). */
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
  image: z.string().trim().max(2000).optional().or(z.literal("")),
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

export const updateOrgMemberSchema = z
  .object({
    organizationId: z.string().min(1),
    memberId: z.string().min(1),
    orgRole: z.string().refine(orgRoleRefine, "Rôle d’organisation invalide."),
    branchIds: z.array(z.string().min(1)).optional(),
    branchCycles: branchCyclesSchema,
    email: z
      .string()
      .trim()
      .min(1, "L’email est requis.")
      .email("Adresse email invalide."),
    nom: namePart,
    postnom: namePart,
    prenom: namePart,
    image: z.string().trim().max(2000).optional().or(z.literal("")),
    dateOfBirth: z.date({
      required_error: "Veuillez saisir la date de naissance",
      invalid_type_error: "Veuillez saisir la date de naissance",
    }),
  })
  .superRefine((data, ctx) => {
    if (memberHasImplicitAllBranchAccess(data.orgRole)) return;
    if (!data.branchIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchIds"],
        message: "Sélectionnez au moins une branche.",
      });
    }
  });

/** Schéma du formulaire d’ajout membre (identité séparée comme un élève). */
export const createOrgMemberFormSchema = createOrgMemberSchema
  .omit({ name: true })
  .extend({
    nom: namePart,
    postnom: namePart,
    prenom: namePart,
    dateOfBirth: z.date({
      required_error: "Veuillez saisir la date de naissance",
      invalid_type_error: "Veuillez saisir la date de naissance",
    }),
  })
  .superRefine((data, ctx) => {
    if (memberHasImplicitAllBranchAccess(data.orgRole)) return;
    if (!data.branchIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchIds"],
        message: "Sélectionnez au moins une branche.",
      });
    }
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
export type CreateOrgMemberFormInput = z.infer<typeof createOrgMemberFormSchema>;
export type UpdateOrgMemberInput = z.infer<typeof updateOrgMemberSchema>;
export type RemoveOrgMemberInput = z.infer<typeof removeOrgMemberSchema>;
export type ArchiveOrgMemberInput = z.infer<typeof archiveOrgMemberSchema>;
export type ResetOrgMemberPasswordInput = z.infer<
  typeof resetOrgMemberPasswordSchema
>;
