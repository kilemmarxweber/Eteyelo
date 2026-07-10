import { z } from "zod";

export const coursOptionPonderationSchema = z.object({
  id: z.string().optional(),
  coursId: z.string().min(1, "Le cours est requis."),
  optionId: z.string().min(1, "L'option est requise."),
  ponderation: z.coerce
    .number()
    .int("La ponderation doit etre un nombre entier.")
    .min(0, "La ponderation ne peut pas etre negative.")
    .max(100, "La ponderation est trop grande."),
});

export type CoursOptionPonderationValues = z.infer<
  typeof coursOptionPonderationSchema
>;

