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
  closesAttendance?: boolean;
  closesForStudents?: boolean;
  closesForTeachers?: boolean;
  closesForPersonnel?: boolean;
  location?: string;
  description?: string;
  titleI18n?: EventLocaleMap | null;
  descriptionI18n?: EventLocaleMap | null;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  classeId?: string;
  classeIds?: string[];
  teachingId?: string;
  schoolYearId?: string;
  typeId?: string;
  /** Création multi-branches (vide = branche courante uniquement). */
  branchIds?: string[];
  /** Créer sur toutes les branches actives de l'organisation. */
  applyToAllBranches?: boolean;
  recurrence: RecurrenceType;
  teaching?: {};
  schoolYear?: ISchoolYear;
  eventType?: { id: string; name: string } | null;
  classe?: { id: string; nameClasse: string; codeClasse: string } | null;
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

export const calendarEventSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(2, "Le titre est requis."),
    dateStart: z.coerce.date(),
    dateEnd: z.coerce.date().optional().nullable(),
    allDay: z.boolean().default(false),
    closesAttendance: z.boolean().default(false),
    closesForStudents: z.boolean().default(true),
    closesForTeachers: z.boolean().default(true),
    closesForPersonnel: z.boolean().default(true),
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
    classeIds: z.array(z.string().min(1)).optional().default([]),
    branchIds: z.array(z.string().min(1)).optional().default([]),
    applyToAllBranches: z.boolean().optional().default(false),
    recurrence: z.nativeEnum(Recurrence).default(Recurrence.HEBDOMADAIRE),
  })
  .superRefine((value, ctx) => {
    if (
      value.closesAttendance &&
      !value.closesForStudents &&
      !value.closesForTeachers &&
      !value.closesForPersonnel
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closesForStudents"],
        message:
          "Choisissez au moins une audience (élèves, enseignants ou personnel).",
      });
    }
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
