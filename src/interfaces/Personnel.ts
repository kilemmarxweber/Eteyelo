import { IUser, phoneRegex } from "./User";
import { z } from "zod";

export interface IPersonnel extends Omit<
  IUser,
  "password" | "role" | "personnelId" | "memberId" | "userId"
> {
  role?: string; // 👈 nouveau
  statusPersonnal: boolean;
  personnelId: string; // 👈 ajouté
  memberId: string; // 👈 ajouté
  userId: string; // 👈 ajouté
}

export const userSchema = z.object({
  username: z.string().min(4, {
    message: "Veuillez saisir votre Code d'acces",
  }),
  name: z.string().min(3, { message: "Veuillez saisir le nom" }),
  postnom: z.string().min(3, { message: "Veuillez saisir le postnom" }),
  prenom: z.string().min(3, { message: "Veuillez saisir le prenom" }),
  dateOfBirth: z.date(),
  sexe: z.string().min(4, { message: "Veuillez saisir le sexe" }),
  telephone: z.string().regex(phoneRegex, "Invalid Number!"),
  address: z.string().min(10, { message: "Veuillez saisir l'adresse" }),
  orgRole: z.string().min(3, {
    message: "Veuillez assigner au moins un rôle",
  }),
  email: z.string(),
  personnelId: z.string().optional(), // 👈 ajouté
  memberId: z.string().optional(), // 👈 ajouté
});

export const updatePersonnelSchema = userSchema.extend({
  personnelId: z.string().optional(),
  memberId: z.string().optional(),
});
