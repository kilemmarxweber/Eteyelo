import { IOption } from "./Option"
import { z } from "zod"
export interface ISection {
    id: string
    codeSection: string;
    nameSection: string;
    option?: IOption[];
    statusSection: boolean
    createdAt: Date;
    updatedAt: Date;
}
export const sectionSchema = z.object({
    id: z.string().optional(),
    codeSection: z.string({ message: "veuillez entrez le code de la section" }).min(2, { message: "le code dois avoir en moyenne 2 caracteres" }),
    nameSection: z.string().min(5, { message: "veillez entrez le nom de la section" }),
    statusSection: z.boolean().optional(),
})