import { z } from "zod";

// import { Recurrence } from "@/prisma/generated/prisma/client"; // Import de l'enum généré par Prisma
// Define Recurrence enum locally to avoid importing Prisma client in client components
export const Recurrence = {
  JOURNALIER: "JOURNALIER",
  HEBDOMADAIRE: "HEBDOMADAIRE",
  MENSUEL: "MENSUEL",
  SEMESTRIEL: "SEMESTRIEL",
  TRIMESTRIEL: "TRIMESTRIEL",
  ANNUEL: "ANNUEL",
} as const;

export type RecurrenceType = (typeof Recurrence)[keyof typeof Recurrence];

import { ISchoolYear } from "./SchoolYear";

export interface ICalendarEvent {
  id: string;
  title?: string;
  dateStart: Date;
  dateEnd?: Date;
  allDay: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  location?: string;
  description?: string;
  classeId?: string;

  teachingId?: String;

  schoolYearId?: string;
  typeId?: string;

  recurrence: RecurrenceType; // Utilisation de l'enum généré par Prisma
  teaching?: {};
  schoolYear?: ISchoolYear;
}

export const calendarEventSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  dateStart: z.date(),
  dateEnd: z.date().optional(),
  allDay: z.boolean(),
  location: z.string().optional(),
  description: z.string().optional(),
  createdBy: z.string(),
  schoolYearId: z.string({
    required_error: "Année scolaire obligatoire",
  }),
  teachingId: z.string().optional(),
  typeId: z.string().optional(),
  classeId: z.string().optional(),
  recurrence: z.nativeEnum(Recurrence),
});

export interface IEventType {
  id: String;
  name: String;
  events: ICalendarEvent[];
}
export const eventTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Le Nom est requis"),
});
export type CalendarEventFormData = z.infer<typeof calendarEventSchema>;
export const calendarEventDbSchema = calendarEventSchema.extend({
  dateStart: z.date(),
});
