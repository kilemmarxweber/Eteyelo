import { z } from "zod";

export interface ICours {
  id: string;
  codeCours: string;
  nameCours: string;
  description: string;
  createdAt?: Date;
}

export const coursSchema = z.object({
  id: z.string().optional(),
  codeCours: z.string().trim().optional().or(z.literal("")),
  nameCours: z
    .string({ message: "veuillez renseigner le nom du cours" })
    .min(4, { message: "Le nom du cours doit avoir au moins 4 caracteres" }),
  description: z.string().optional(),
});
