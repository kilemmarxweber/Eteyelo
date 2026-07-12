import { z } from "zod";
import { IClasse } from "./Classe";
import { ISchoolYear } from "./SchoolYear";
import { IStudent } from "./Student";

export interface IclassEnrollment
  extends Omit<ISchoolYear, "id">, Omit<IStudent, "id">, Omit<IClasse, "id"> {
  id: string;
  schoolYearId: string;
  classeId: string;
  studentId: string;
  statusEnrollment: boolean;
}

export const classEnrollmentSchema = z.object({
  id: z.string().optional(),
  schoolYearId: z.string().min(1, "Veuillez selectionner l'annee scolaire"),
  classeId: z.string().min(1, "Veuillez selectionner la classe"),
  studentId: z.string().min(1, "Veuillez selectionner l'eleve"),
  statusEnrollment: z.boolean().optional(),
});
