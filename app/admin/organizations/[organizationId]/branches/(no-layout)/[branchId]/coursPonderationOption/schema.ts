import { z } from "zod";

/** Entiers (secondaire) ou demi-unités (primaire RDC : 0.5 → max 5). */
export const coursOptionPonderationSchema = z.object({
  id: z.string().optional(),
  coursId: z.string().min(1, "Le cours est requis."),
  optionId: z.string().min(1, "L'option est requise."),
  optionIds: z.array(z.string().min(1)).optional(),
  level: z.string().trim().optional(),
  levels: z.array(z.string().trim()).optional(),
  ponderation: z.coerce
    .number()
    .min(0, "La ponderation ne peut pas etre negative.")
    .max(100, "La ponderation est trop grande.")
    .refine(
      (value) => Number.isFinite(value) && Math.abs(value * 2 - Math.round(value * 2)) < 1e-9,
      "La ponderation doit etre un multiple de 0,5.",
    ),
});

export type CoursOptionPonderationValues = z.infer<
  typeof coursOptionPonderationSchema
>;
