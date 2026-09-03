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
  /** Cycles ACL du membre dans la branche (création / édition). */
  cycles?: string[];
  /** Profil enseignant actif en plus du profil personnel. */
  alsoTeacher?: boolean;
  /** Forfait mensuel connu (devise de base). */
  monthlyForfait?: number | null;
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
  address: z.string().trim().min(1, { message: "Veuillez saisir l'adresse" }),
  orgRole: z.string().min(3, {
    message: "Veuillez assigner au moins un rôle",
  }),
  email: z.string(),
  image: z.string().trim().max(2000).optional().or(z.literal("")),
  personnelId: z.string().optional(), // 👈 ajouté
  memberId: z.string().optional(), // 👈 ajouté
  cycles: z.array(z.string()),
  monthlyForfait: z.number().nonnegative().nullable().optional(),
});

export const updatePersonnelSchema = userSchema.extend({
  personnelId: z.string().optional(),
  memberId: z.string().optional(),
});
