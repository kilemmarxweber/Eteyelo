import { IUser, phoneRegex } from "./User"; // Importer l'interface IUser
import { IParent } from "./Parent"; // Importer l'interface IParent
import { IPaiement } from "./Paiement"; // Importer l'interface IPaiement

import { z } from "zod";
//import { StudentCategory } from "@/prisma/generated/prisma/client";

// Define StudentCategory enum locally to avoid importing Prisma client in client components
export const StudentCategoryEnum = z.enum([
  "NORMAL",
  "ORPHAN",
  "VIP",
  "SPONSORED",
  "GROUPE",
]);
export type StudentCategoryType = z.infer<typeof StudentCategoryEnum>;

export interface IStudent extends Omit<
  IUser,
  "password" | "memberId" | "userId" | "role"
> {
  placeOfBirth?: string | null;
  classCode?: string | null;
  className?: string | null;
  sourceBranchName?: string | null;
  sourceBranchId?: string | null;
  isLinkedStudent?: boolean;
  paiement?: IPaiement[];
  parent?: IParent;
  category: StudentCategoryType;
  role?: string; // 👈 nouveau
  memberId: string; // 👈 ajouté
  userId: string; // 👈 ajouté
}

export const deleteStudentSchema = z.object({
  id: z.string(),
});

export const studentSchema = z.object({
  username: z.string().min(4, {
    message: "Veuillez saisir votre Code d'acces",
  }),
  name: z.string().min(3, { message: "Veuillez saisir le nom" }),
  postnom: z.string().min(3, { message: "Veuillez saisir le postnom" }),
  prenom: z.string().min(3, { message: "Veuillez saisir le prenom" }),
  dateOfBirth: z.date(),
  sexe: z.string().min(4, { message: "Veuillez saisir le sexe" }),
  telephone: z
    .string()
    .startsWith("+243")
    .regex(/^\+243\d{9}$/, "Numéro invalide (format +243XXXXXXXXX)"),
  address: z.string().min(10, { message: "Veuillez saisir l'adresse" }),
  orgRole: z
    .string()
    .min(3, {
      message: "Veuillez assigner au moins un rôle",
    })
    .optional(),
  email: z.string(),
  memberId: z.string().optional(), // 👈 ajouté
  parentId: z.string().min(1, { message: "Veuillez selectionner un parent" }),
  placeOfBirth: z.string().trim().optional(),
  category: StudentCategoryEnum,
  studentId: z.string().optional(), // Ajout du champ parentId optionnel
});

export const updateStudentSchema = studentSchema.extend({
  studentId: z.string().optional(),
  memberId: z.string().optional(),
});
