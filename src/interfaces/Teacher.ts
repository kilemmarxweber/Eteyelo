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
  /** Cycles des affectations actives (classe.cycle ?? type de branche). */
  assignmentCycles?: string[];
  cycleAssignmentCount?: Record<string, number>;
  classesByCycle?: Record<string, string[]>;
  coursesByCycle?: Record<string, string[]>;
  estTitulaire?: boolean;
  classeId?: string;
  coursId?: string;
  /** Cycles ACL du membre dans la branche (création / édition). */
  cycles?: string[];
  /** Profil personnel actif en plus du profil enseignant. */
  alsoPersonnel?: boolean;
}

export const teacherSchema = z
  .object({
    id: z.string().optional(),
    teacherId: z.string().optional(),
    username: z.string(),
    nom: z.string(),
    postnom: z.string(),
    prenom: z.string(),
    dateOfBirth: z.date({
      required_error: "Veuillez saisir la date de naissance",
      invalid_type_error: "Veuillez saisir la date de naissance",
    }),
    sexe: z.string().min(1, { message: "Veuillez selectionner le sexe" }),
    telephone: z
      .string()
      .trim()
      .min(1, { message: "Veuillez saisir le numéro de téléphone" })
      .max(14, { message: "Le numéro ne doit pas dépasser 14 caractères" }),
    email: z.string().optional(),
    address: z.string().trim().min(1, { message: "Veuillez saisir l'adresse" }),
    image: z.string().trim().max(2000).optional().or(z.literal("")),
  cycles: z.array(z.string()),
  /** Titulaire / superviseur de classe (crée une affectation Teaching). */
  estTitulaire: z.boolean().optional(),
  classeId: z.string().optional(),
  coursId: z.string().optional(),
  weeklyHours: z.coerce.number().positive().optional(),
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
