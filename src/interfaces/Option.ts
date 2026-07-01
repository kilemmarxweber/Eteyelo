import { z } from "zod";
import { IClasse } from "./Classe"
import { ISection } from "./Section";

export interface IOption {
  id: string;
  codeOption: string;
  nameOption: string;

  sectionId?: string;

  // ✅ FLAT FIELDS
  nameSection?: string;
  codeSection?: string;
  statuSection?: boolean;

  classes?: IClasse[] | null;

  statusOption: boolean;

  module: string;

  createdAt: Date;
  updatedAt: Date;
}
export const optionSchema = z.object({
    id: z.string().optional(),
    codeOption: z.string({ message: "veuillez saisir le codeOption" }).min(2, { message: "le code doit avoir au moins 2 caractères" }),
    nameOption: z.string({ message: "veuillez saisir le codeOption" }).min(5, { message: "le code doit avoir au moins 5 caractères" }),
    sectionId: z.string().optional(),
    statusOption: z.boolean().optional(),
})