import { z } from "zod";
import type { Day } from "@/prisma/generated/prisma/client";
import {
  CRENEAU_WEEKDAY_OPTIONS,
  DEFAULT_CRENEAU_WORKING_DAYS,
} from "@/lib/creneau-working-days";

export interface ICreneau {
  id: string;
  nameCreneau: string;
  startTime: string;
  endTime: string;
  durationCourse: number;
  recreationHour: string;
  recreationDuration: number;
  workingDays?: Day[];
  isArchived?: boolean;
  classesCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

const weekdayEnum = z.enum(
  CRENEAU_WEEKDAY_OPTIONS.map((d) => d.value) as [
    (typeof CRENEAU_WEEKDAY_OPTIONS)[number]["value"],
    ...(typeof CRENEAU_WEEKDAY_OPTIONS)[number]["value"][],
  ],
);

export const defaultCreneauValues = {
  nameCreneau: "",
  startTime: "",
  endTime: "",
  durationCourse: 45,
  recreationHour: "",
  recreationDuration: 15,
  workingDays: [...DEFAULT_CRENEAU_WORKING_DAYS] as Day[],
};

/** Atelier : séance longue possible, sans récréation. */
export const defaultAtelierCreneauValues = {
  nameCreneau: "",
  startTime: "07:30",
  endTime: "13:30",
  durationCourse: 360,
  recreationHour: "07:30",
  recreationDuration: 0,
  workingDays: [...DEFAULT_CRENEAU_WORKING_DAYS] as Day[],
};

const creneauFieldsSchema = z.object({
  id: z.string().optional(),
  nameCreneau: z.string().min(1, "Le nom du créneau est requis"),
  startTime: z.string().regex(timeRegex, "Format d'heure invalide (HH:MM)"),
  endTime: z.string().regex(timeRegex, "Format d'heure invalide (HH:MM)"),
  durationCourse: z
    .number({
      required_error: "La durée du cours est requise",
      invalid_type_error: "La durée du cours doit être un nombre",
    })
    .int()
    .positive("La durée doit être un nombre positif")
    .max(720, "La durée ne peut pas dépasser 720 minutes"),
  recreationHour: z.string(),
  recreationDuration: z
    .number({
      required_error: "La durée de la récréation est requise",
      invalid_type_error: "La durée de la récréation doit être un nombre",
    })
    .int()
    .min(0, "La durée ne peut pas être négative")
    .max(120, "La durée de récréation est trop longue"),
  workingDays: z
    .array(weekdayEnum)
    .min(1, "Sélectionnez au moins un jour ouvrable."),
});

export const creneauSchema = creneauFieldsSchema
  .refine((data) => data.endTime > data.startTime, {
    message: "L'heure de fin doit être après l'heure de début",
    path: ["endTime"],
  })
  .superRefine((data, ctx) => {
    // Sans récréation (atelier) : on ignore l'heure de pause.
    if (data.recreationDuration <= 0) return;
    if (!timeRegex.test(data.recreationHour)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Format d'heure invalide (HH:MM)",
        path: ["recreationHour"],
      });
      return;
    }
    if (
      data.recreationHour < data.startTime ||
      data.recreationHour > data.endTime
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "L'heure de récréation doit être entre le début et la fin",
        path: ["recreationHour"],
      });
    }
  });

export type CreneauFormValues = z.infer<typeof creneauSchema>;

/** Normalise les champs récréation pour l'atelier (toujours ignorés). */
export function stripRecreationForAtelier(
  data: CreneauFormValues,
): CreneauFormValues {
  return {
    ...data,
    recreationDuration: 0,
    recreationHour: data.startTime || "07:30",
  };
}
