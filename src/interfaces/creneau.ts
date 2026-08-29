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
    .positive("La durée doit être un nombre positif"),
  recreationHour: z
    .string()
    .regex(timeRegex, "Format d'heure invalide (HH:MM)"),
  recreationDuration: z
    .number({
      required_error: "La durée de la récréation est requise",
      invalid_type_error: "La durée de la récréation doit être un nombre",
    })
    .int()
    .positive("La durée doit être un nombre positif"),
  workingDays: z
    .array(weekdayEnum)
    .min(1, "Sélectionnez au moins un jour ouvrable."),
});

export const creneauSchema = creneauFieldsSchema
  .refine((data) => data.endTime > data.startTime, {
    message: "L'heure de fin doit être après l'heure de début",
    path: ["endTime"],
  })
  .refine(
    (data) =>
      data.recreationHour >= data.startTime &&
      data.recreationHour <= data.endTime,
    {
      message: "L'heure de récréation doit être entre le début et la fin",
      path: ["recreationHour"],
    },
  );

export type CreneauFormValues = z.infer<typeof creneauSchema>;
