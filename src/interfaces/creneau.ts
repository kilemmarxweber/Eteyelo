import { z } from "zod";

export interface ICreneau {
  id: string;
  nameCreneau: string;
  startTime: string;
  endTime: string;
  durationCourse: number;
  recreationHour: string;
  recreationDuration: number;
  createdAt: Date;
  updatedAt: Date;
}
export const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
export const creneauSchema = z.object({
  id: z.string().optional(),
  nameCreneau: z.string().min(1, "Le nom du créneau est requis"),
  startTime: z.string().regex(timeRegex, "Format d'heure invalide (HH:MM)"),
  endTime: z.string().regex(timeRegex, "Format d'heure invalide (HH:MM)"),
  durationCourse: z
    .number()
    .int()
    .positive("La durée doit être un nombre positif"),
  recreationHour: z
    .string()
    .regex(timeRegex, "Format d'heure invalide (HH:MM)"),
  recreationDuration: z
    .number()
    .int()
    .positive("La durée doit être un nombre positif"),
});
