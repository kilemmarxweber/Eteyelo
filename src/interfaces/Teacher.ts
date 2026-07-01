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
}

export const teacherSchema = z.object({
  id: z.string().optional(),
  teacherId: z.string().optional(),
  username: z.string(),
  nom: z.string(),
  postnom: z.string(),
  prenom: z.string(),
  dateOfBirth: z.date().optional(),
  sexe: z.string(),
  telephone: z.string(),
  email: z.string().optional(),
  address: z.string().min(10, { message: "Veuillez saisir l'adresse" }),
});
export const deleteTeacherSchema = z.object({
  id: z.string(),
});
