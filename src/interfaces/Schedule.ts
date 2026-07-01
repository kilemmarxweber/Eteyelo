// Define Day enum locally to avoid importing Prisma client in client components
import { Day } from "@/prisma/generated/prisma/client";

export type DayType = (typeof Day)[keyof typeof Day];
// import { Day } from "@/prisma/generated/prisma/client";
import { z } from "zod";
import { timeRegex } from "./creneau";

export interface ISchedule {
  id: string;
  day: DayType;
  hour: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  teacher?: {
    id: string;
    nom: string;
    postnom: string;
    prenom: string;
    telephone: string;
    email: string;
  };
  classe?: {
    id: string;
    codeClasse: string;
    nameClasse: string;
  };
  cours?: {
    id: string;
    codeCours: string;
    nameCours: string;
  };
}
export const scheduleSchema = z.object({
  id: z.string().optional(),
  coursId: z.string().optional(),
  classeId: z.string(),
  teachingId: z.string().optional(),
  hour: z.string().regex(timeRegex, "Format d'heure invalide (HH:MM)"),
  day: z.enum(["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]),
  createdBy: z.string(),
});
