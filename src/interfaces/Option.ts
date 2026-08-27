import { z } from "zod";
import { IClasse } from "./Classe";

export interface IOption {
  id: string;
  codeOption: string;
  nameOption: string;
  sectionId?: string;
  nameSection?: string;
  codeSection?: string;
  statuSection?: boolean;
  classes?: IClasse[] | null;
  classesCount?: number;
  statusOption: boolean;
  module: string;
  cycle?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const optionSchema = z.object({
  id: z.string().optional(),
  codeOption: z.string().trim().optional().or(z.literal("")),
  nameOption: z
    .string({ message: "veuillez saisir le nom de l'option" })
    .min(5, { message: "Le nom doit avoir au moins 5 caracteres" }),
  sectionId: z.string().optional(),
  statusOption: z.boolean().optional(),
});
