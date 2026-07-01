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
  id: z.string({ message: "veuillez selectionner le " }).optional(),
  schoolYearId: z.string({ message: "veuillez selectionner l'année scolaire" }),
  classeId: z.string({ message: "veuillez selectionner la classe" }),
  studentId: z.string({ message: "veuillez selectionner l'élève" }),
  statusEnrollment: z.boolean().optional(),
});
