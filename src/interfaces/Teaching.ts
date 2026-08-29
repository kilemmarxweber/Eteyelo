import { z } from "zod";
import { IClasse } from "./Classe";
import { ISchoolYear } from "./SchoolYear";
import { ITeacher } from "./Teacher";
import { ICours } from "./Cours";

export const TEACHING_WEEKDAY_VALUES = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

export type TeachingWeekday = (typeof TEACHING_WEEKDAY_VALUES)[number];

export const teachingWeekdaySchema = z.enum(TEACHING_WEEKDAY_VALUES);

/** 1 = séances isolées ; 2–4 = blocs d'affilée (ex. 7h30→8h15 puis 8h15→9h00). */
export const consecutiveSlotsSchema = z.coerce
  .number({ invalid_type_error: "Indiquez le nombre de périodes d'affilée" })
  .int()
  .min(1, "Minimum 1 période")
  .max(4, "Maximum 4 périodes d'affilée")
  .nullable()
  .optional();

export interface ITeaching
  extends
    Omit<ITeacher, "id">,
    Omit<IClasse, "id">,
    Omit<ISchoolYear, "id">,
    Omit<ICours, "id"> {
  id: string;
  teacherId: string;
  classeId: string;
  schoolYearId: string;
  coursId: string;
  titulaire: boolean;
  statusTeaching: boolean;
  weeklyHours?: number | null;
  consecutiveSlots?: number | null;
  preferredDays?: TeachingWeekday[];
  createdAt: Date;
  updatedAt: Date;
}

export const teachingSchema = z.object({
  id: z.string().optional(),
  teacherId: z.string().min(1, "Veuillez selectionner un enseignant"),
  classeId: z.string().min(1, "Veuillez selectionner une classe"),
  coursId: z.string().min(1, "Veuillez selectionner un cours"),
  schoolYearId: z.string().min(1, "Veuillez selectionner l'annee scolaire"),
  titulaire: z.boolean().optional(),
  weeklyHours: z.coerce
    .number({ invalid_type_error: "Indiquez les minutes / semaine" })
    .positive("Les minutes / semaine doivent être > 0")
    .max(600, "Maximum 600 min / semaine pour une affectation"),
  consecutiveSlots: consecutiveSlotsSchema,
  preferredDays: z.array(teachingWeekdaySchema).optional().default([]),
});
