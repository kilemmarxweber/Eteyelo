import { z } from "zod";

export interface ICreneau {
  id: string;
  nameCreneau: string;
  startTime: string;
  endTime: string;
  durationCourse: number;
  recreationHour: string;
  recreationDuration: number;
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

export const defaultCreneauValues = {
  nameCreneau: "",
  startTime: "",
  endTime: "",
  durationCourse: 45,
  recreationHour: "",
  recreationDuration: 15,
} as const;

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
