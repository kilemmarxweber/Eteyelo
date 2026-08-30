import { z } from "zod";

import { EDUCATION_SYSTEMS } from "@/lib/education-system";
import { branchTypeSchema } from "@/lib/schemas/extended-branch";

const branchImagesSchema = z.object({
  logo: z.string(),
  event: z.array(z.string()),
  gallery: z.array(z.string()),
  ecole: z.array(z.string()),
});

export const createBranchFormObjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(180, "Le nom est trop long."),
  description: z
    .string()
    .trim()
    .max(2000, "La description ne doit pas dépasser 2000 caractères.")
    .optional()
    .or(z.literal("")),
  code: z
    .string()
    .trim()
    .max(32, "Le code est trop long.")
    .optional()
    .or(z.literal("")),
  adresse: z.string().optional(),
  /** Texte optionnel « à la une » sur la page d'accueil */
  note: z
    .string()
    .trim()
    .max(500, "La note ne doit pas dépasser 500 caractères.")
    .optional()
    .or(z.literal("")),
  province: z.string().optional(),
  ville: z.string().optional(),
  commune: z.string().optional(),
  pays: z.string().optional(),
  idnat: z.string().optional(),
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
  typebranch: branchTypeSchema,
  schoolCycles: z
    .array(z.enum(["MATERNELLE", "PRIMAIRE", "SECONDAIRE"] as const))
    .optional()
    .default([]),
  educationSystem: z.enum(EDUCATION_SYSTEMS).default("CONGOLAIS"),
  image: branchImagesSchema.default({
    logo: "",
    event: [],
    gallery: [],
    ecole: [],
  }),
});

export function refineBranchSchoolCycles(
  data: { typebranch: string; schoolCycles?: string[]; educationSystem?: string },
  ctx: z.RefinementCtx,
) {
  const isExtended =
    data.typebranch === "ATELIER" ||
    data.typebranch === "CENTRE_FORMATION" ||
    data.typebranch === "UNIVERSITE";
  if (isExtended) return;
  if (!data.schoolCycles?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["schoolCycles"],
      message:
        "Choisissez au moins un cycle : maternelle, primaire ou secondaire.",
    });
  }
  if (
    data.educationSystem === "ANGOLAIS" &&
    data.schoolCycles?.includes("MATERNELLE")
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["schoolCycles"],
      message:
        "Le système angolais n'inclut pas la maternelle. Choisissez Ensino primário ou Ensino secundário.",
    });
  }
}

export const createBranchFormSchema = createBranchFormObjectSchema.superRefine(
  refineBranchSchoolCycles,
);
export type CreateBranchFormValues = z.input<typeof createBranchFormObjectSchema>;
