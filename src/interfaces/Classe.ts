import { z } from "zod";
import { IOption } from "./Option";
import { ICreneau } from "./creneau";

export interface IClasse {
  id: string;
  codeClasse: string;
  nameClasse: string;
  level?: string | null;
  parallel?: string | null;
  capacity?: number | null;
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
  codeClasse: z.string().trim().optional().or(z.literal("")),
  nameClasse: z
    .string({ message: "veuillez entrer le nom de la classe" })
    .min(5, {
      message: "Le nom de la classe doit avoir au moins 5 caracteres",
    })
    .optional(),
  level: z.string().trim().optional(),
  parallel: z.string().trim().optional(),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  optionId: z.string().optional(),
  creneauId: z.string().optional(),
  statusClasse: z.boolean().optional(),
});

export const classeCreateSchema = z.object({
  id: z.string().optional(),
  codeClasse: z.string().trim().optional().or(z.literal("")),
  nameClasse: z.string().trim().optional(),
  level: z.string().trim().min(1, {
    message: "Veuillez selectionner un niveau",
  }),
  parallel: z.string().trim().optional(),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  optionId: z.string().optional(),
  creneauId: z.string().optional(),
  statusClasse: z.boolean().optional(),
});

export const classeLegacyUpdateSchema = z.object({
  id: z.string(),
  codeClasse: z.string().trim().optional().or(z.literal("")),
  nameClasse: z
    .string({ message: "veuillez entrer le nom de la classe" })
    .min(5, {
      message: "Le nom de la classe doit avoir au moins 5 caracteres",
    }),
  parallel: z.string().trim().optional(),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  optionId: z.string().optional(),
  creneauId: z.string().optional(),
  statusClasse: z.boolean().optional(),
});
