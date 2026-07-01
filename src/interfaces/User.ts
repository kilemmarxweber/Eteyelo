import { z } from "zod";
export const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/,
);
export interface IUser {
  id: string;
  username?: string;
  email?: string;
  telephone?: string;
  nom: string;
  postnom: string;
  prenom?: string;
  dateOfBirth: Date;
  sexe: string;
  image?: string;
  password: string;
  statusUser: boolean;
  createdAt: Date;
  updatedAt: Date;
  address: string;
}

export const userSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().optional(),
  username: z.string().min(4, {
    message: "Veuillez saisir votre Code d'acces",
  }),
  email: z.string().optional(),
  nom: z.string().min(3, { message: "Veuillez saisir nom" }),
  postnom: z.string().min(3, { message: "Veuillez saisir le postnom" }),
  prenom: z.string().min(3, { message: "Veuillez saisir le prenom" }),
  dateOfBirth: z.date().optional(),
  sexe: z.string().min(4, { message: "Veuillez saisir le sexe" }),
  telephone: z.string().optional(),
  password: z.string().min(4, {
    message: "Le mot de passe dois avoir au moins 8 caractères",
  }),
  address: z.string().min(10, { message: "Veuillez saisir l'adresse" }),
});
export const updateUserSchema = z.object({
  id: z.string(),
  username: z.string().optional(),
  email: z.string().email().optional(),
  nom: z.string().optional(),
  postnom: z.string().optional(),
  prenom: z.string().optional(),
  dateOfBirth: z.date().optional(),
  sexe: z.string().optional(),
  telephone: z.string().optional(),
  address: z.string().optional(),
  password: z.string().optional(),
});
