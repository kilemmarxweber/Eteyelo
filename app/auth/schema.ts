import { z } from "zod";

/** Aligné sur les limites Better Auth (email + mot de passe). */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L'email est requis.")
    .email("Adresse email invalide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom est trop long."),
  email: z
    .string()
    .trim()
    .min(1, "L'email est requis.")
    .email("Adresse email invalide."),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    )
    .max(MAX_PASSWORD_LENGTH, "Le mot de passe est trop long."),
});

/** Première connexion : aucun critère de complexité, tous caractères acceptés. */
export const firstLoginPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "L'ancien mot de passe est requis."),
    newPassword: z.string().min(1, "Le nouveau mot de passe est requis."),
    confirmPassword: z.string().min(1, "Confirmez le nouveau mot de passe."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type FirstLoginPasswordValues = z.infer<typeof firstLoginPasswordSchema>;
