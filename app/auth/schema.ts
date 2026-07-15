import { z } from "zod";

/** Aligné sur les limites Better Auth (email + mot de passe). */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

const HAS_LOWERCASE = /[a-z]/;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;

export const strongPasswordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  )
  .max(MAX_PASSWORD_LENGTH, "Le mot de passe est trop long.")
  .refine((value) => HAS_LOWERCASE.test(value), {
    message: "Le mot de passe doit contenir au moins une lettre minuscule.",
  })
  .refine((value) => HAS_UPPERCASE.test(value), {
    message: "Le mot de passe doit contenir au moins une lettre majuscule.",
  })
  .refine((value) => HAS_DIGIT.test(value) || HAS_SPECIAL.test(value), {
    message:
      "Le mot de passe doit contenir au moins un chiffre ou un caractère spécial.",
  });

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L’email est requis.")
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
    .min(1, "L’email est requis.")
    .email("Adresse email invalide."),
  password: strongPasswordSchema,
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
