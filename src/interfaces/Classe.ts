import { z } from "zod";
import { IOption } from "./Option";
import { ICreneau } from "./creneau";

export interface IClasse {
  id: string;
  codeClasse: string;
  nameClasse: string;
  statusClasse: boolean;
  optionId?: string;
  creneauId?: string;
  option?: IOption;
  creneau?: ICreneau;
  createdAt: Date;
  updatedAt: Date;
}
export const classeSchema = z.object({
  id: z.string().optional(),
  codeClasse: z
    .string({ message: "veuillez entrez le code de la classe" })
    .min(2, {
      message: "Le code de la classe doit avoir au moins 5 caractères",
    }),
  nameClasse: z
    .string({ message: "veuillez entrez le nom de la classe" })
    .min(5, {
      message: "Le nom de la classe doit avoir au moins 5 caractères",
    }),
  optionId: z.string().optional(),
  creneauId: z.string().optional(),
  statusClasse: z.boolean().optional(),
});
