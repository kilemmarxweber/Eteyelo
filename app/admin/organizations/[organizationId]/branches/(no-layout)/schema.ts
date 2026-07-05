import { z } from "zod";

export const createBranchFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom est trop long."),
  code: z
    .string()
    .trim()
    .max(32, "Le code est trop long.")
    .optional()
    .or(z.literal("")),
  adresse: z.string().optional(),
  ville: z.string().optional(),
  pays: z.string().optional(),
  idnat: z.string().optional(),
  image: z.string().trim().optional(),
  tel: z
    .string()
    .trim()
    .max(15, "Le numéro ne doit pas dépasser 15 caractères.")
    .optional(),
  latitude: z.coerce
    .number({ invalid_type_error: "La latitude est requise." })
    .min(-90, "La latitude doit être comprise entre -90 et 90.")
    .max(90, "La latitude doit être comprise entre -90 et 90."),
  longitude: z.coerce
    .number({ invalid_type_error: "La longitude est requise." })
    .min(-180, "La longitude doit être comprise entre -180 et 180.")
    .max(180, "La longitude doit être comprise entre -180 et 180."),
  attendanceRadius: z.coerce
    .number({ invalid_type_error: "Le rayon est requis." })
    .int("Le rayon doit être un nombre entier.")
    .min(10, "Le rayon doit être au moins 10 mètres.")
    .max(10000, "Le rayon est trop grand."),
});

export type CreateBranchFormValues = z.infer<typeof createBranchFormSchema>;
