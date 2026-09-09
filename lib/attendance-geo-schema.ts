import { z } from "zod";

/**
 * Les tablettes / PC / GPS indoor envoient souvent `accuracy` >> 5 km.
 * On accepte la valeur brute : le rayon réel est plafonné dans `clampGpsAccuracy`.
 */
export const attendanceGeoCoordsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z
    .number()
    .optional()
    .transform((value) => {
      if (value == null || !Number.isFinite(value) || value < 0) {
        return undefined;
      }
      return value;
    }),
});
