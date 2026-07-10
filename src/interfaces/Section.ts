import { IOption } from "./Option";
import { z } from "zod";

export interface ISection {
  id: string;
  codeSection: string;
  nameSection: string;
  option?: IOption[];
  statusSection: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const sectionSchema = z.object({
  id: z.string().optional(),
  codeSection: z.string().trim().optional().or(z.literal("")),
  nameSection: z
    .string()
    .min(5, { message: "Veuillez entrer le nom de la section" }),
  statusSection: z.boolean().optional(),
});
