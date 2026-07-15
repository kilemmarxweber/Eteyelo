import { z } from "zod";
import { strongPasswordSchema } from "@/app/auth/schema";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom est trop long."),
  image: z
    .string()
    .trim()
    .max(2_000_000, "Image trop volumineuse.")
    .optional()
    .or(z.literal("")),
});

export const changeEmailSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .min(1, "L’email est requis.")
    .email("Adresse email invalide."),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis."),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirmez le mot de passe."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Le nouveau mot de passe doit être différent de l’actuel.",
    path: ["newPassword"],
  });

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>;
export type ChangeEmailValues = z.infer<typeof changeEmailSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
