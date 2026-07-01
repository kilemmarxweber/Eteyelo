import { z } from "zod";

export interface ICours {
    id: string;
    codeCours: string;
    nameCours: string;
    description: string
    ponderation: number
}
export const coursSchema = z.object({
    id: z.string().optional(),
    codeCours: z.string({ message: "veuillez renseignez la code du cours" })
        .min(2, { message: "le code du cours doit avoir au moins 2 caractères" }),
    nameCours: z.string({ message: "veuillez renseignez le nom du cours" })
        .min(4, { message: "le nom du cours doit avoir au moins 4 caractères" }),
    description: z.string().optional(),
    ponderation: z.number()
        .min(2, { message: "le code du cours doit avoir au moins 2 chiffres" })
})

