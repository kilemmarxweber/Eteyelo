import { z } from "zod";
import { IClasse } from "./Classe";
import { ISchoolYear } from "./SchoolYear";
import { ITeacher } from "./Teacher";
import { ICours } from "./Cours";

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
});
