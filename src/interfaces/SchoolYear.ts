import { z } from "zod";
export interface ISchoolYear {
  id: string;
  nameYear: string;
  startYear: Date;
  endYear: Date;
  isCurrentYear: boolean;
  branchId: string;
}

export const schoolYearSchema = z.object({
  id: z.string().optional(),
  nameYear: z
    .string({ message: "veuillez entrer le nom de l'année scolaire" })
    .min(8, {
      message: "le nom de l'année scolaire dois avoir au moins 8 caractèreq",
    }),
  startYear: z.date({ message: "veuillez entrez la date du debut" }),
  endYear: z.date({ message: "veuillez entrez la date de fin" }),
  isCurrentYear: z.boolean().default(false),
});

export const deleteSchoolYearSchema = z.object({
  id: z.string(),
});
