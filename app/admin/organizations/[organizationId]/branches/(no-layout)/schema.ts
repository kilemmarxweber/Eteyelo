import { z } from "zod";

import { EDUCATION_SYSTEMS } from "@/lib/education-system";
import { branchTypeSchema } from "@/lib/schemas/extended-branch";

const branchImagesSchema = z.object({
  logo: z.string(),
  event: z.array(z.string()),
  gallery: z.array(z.string()),
  ecole: z.array(z.string()),
});

function requiredCoordinate(axis: "latitude" | "longitude") {
  const bounds =
    axis === "latitude"
      ? { min: -90, max: 90, label: "La latitude" }
      : { min: -180, max: 180, label: "La longitude" };
  const required = `${bounds.label} est requise. Capturez le GPS sur le site ou cliquez sur la carte.`;

  return z.preprocess((value) => {
    if (value === "" || value == null) return undefined;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, z
    .number({
      required_error: required,
      invalid_type_error: required,
    })
    .min(bounds.min, `${bounds.label} doit être comprise entre ${bounds.min} et ${bounds.max}.`)
    .max(bounds.max, `${bounds.label} doit être comprise entre ${bounds.min} et ${bounds.max}.`));
}

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
  latitude: requiredCoordinate("latitude"),
  longitude: requiredCoordinate("longitude"),
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
  options?: { allowAngolaMaternelle?: boolean },
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
    !options?.allowAngolaMaternelle &&
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
export const updateBranchFormSchema = createBranchFormObjectSchema.superRefine(
  (data, ctx) =>
    refineBranchSchoolCycles(data, ctx, { allowAngolaMaternelle: true }),
);
export type CreateBranchFormValues = z.input<typeof createBranchFormObjectSchema>;
