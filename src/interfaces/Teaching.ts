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
  teacherId: z.string(),
  classeId: z.string(),
  coursId: z.string(),
  schoolYearId: z.string(),
  titulaire: z.boolean().optional(),
});
