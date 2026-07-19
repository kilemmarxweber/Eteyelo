import { z } from "zod";
import type { EventLocaleMap } from "@/lib/calendar-event-i18n";

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
  image?: string | null;
  allDay: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  location?: string;
  description?: string;
  titleI18n?: EventLocaleMap | null;
  descriptionI18n?: EventLocaleMap | null;
  classeId?: string;
  teachingId?: string;
  schoolYearId?: string;
  typeId?: string;
  recurrence: RecurrenceType;
  teaching?: {};
  schoolYear?: ISchoolYear;
  eventType?: { id: string; name: string } | null;
}

const localeMapSchema = z
  .object({
    fr: z.string().optional(),
    en: z.string().optional(),
    pt: z.string().optional(),
    ln: z.string().optional(),
  })
  .optional()
  .nullable();

export const calendarEventSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, "Le titre est requis."),
  dateStart: z.coerce.date(),
  dateEnd: z.coerce.date().optional().nullable(),
  allDay: z.boolean().default(false),
  location: z.string().nullish().transform((value) => value ?? ""),
  description: z.string().nullish().transform((value) => value ?? ""),
  image: z.string().nullish().transform((value) => value ?? ""),
  titleI18n: localeMapSchema,
  descriptionI18n: localeMapSchema,
  translationsEnabled: z.boolean().optional(),
  createdBy: z.string().optional(),
  schoolYearId: z.string().optional(),
  teachingId: z.string().optional().nullable(),
  typeId: z.string().optional().nullable(),
  classeId: z.string().optional().nullable(),
  recurrence: z.nativeEnum(Recurrence).default(Recurrence.HEBDOMADAIRE),
});

export interface IEventType {
  id: string;
  name: string;
  events: ICalendarEvent[];
}

export const eventTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Le Nom est requis"),
});

export type CalendarEventFormData = z.infer<typeof calendarEventSchema>;
/** Valeurs formulaire (avant transforms) — pour react-hook-form + zodResolver. */
export type CalendarEventFormInput = z.input<typeof calendarEventSchema>;
export const calendarEventDbSchema = calendarEventSchema;
