import { z } from "zod";
import { ITeaching } from "./Teaching";
import { IUser } from "./User";

export interface ITeacher
  extends Omit<IUser, "password" | "memberId" | "userId" | "role"> {
  teaching?: ITeaching[];
  role?: string;
  teacherId: string;
  memberId: string;
  userId: string;
  assignmentStatus?: "assigned" | "unassigned";
  assignmentCount?: number;
  classCount?: number;
  courseCount?: number;
  classNames?: string[];
  courseNames?: string[];
  estTitulaire?: boolean;
  classeId?: string;
  coursId?: string;
}

export const teacherSchema = z
  .object({
    id: z.string().optional(),
    teacherId: z.string().optional(),
    username: z.string(),
    nom: z.string(),
    postnom: z.string(),
    prenom: z.string(),
    dateOfBirth: z.date().optional(),
    sexe: z.string().min(1, { message: "Veuillez selectionner le sexe" }),
    telephone: z
      .string()
      .trim()
      .min(1, { message: "Veuillez saisir le numéro de téléphone" })
      .max(14, { message: "Le numéro ne doit pas dépasser 14 caractères" }),
    email: z.string().optional(),
    address: z.string().min(10, { message: "Veuillez saisir l'adresse" }),
    /** Titulaire / superviseur de classe (crée une affectation Teaching). */
    estTitulaire: z.boolean().optional(),
    classeId: z.string().optional(),
    coursId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.estTitulaire) return;

    if (!data.classeId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Veuillez sélectionner la classe",
        path: ["classeId"],
      });
    }

    if (!data.coursId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Veuillez sélectionner le cours principal",
        path: ["coursId"],
      });
    }
  });
export const deleteTeacherSchema = z.object({
  id: z.string(),
});
