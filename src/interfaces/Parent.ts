import { IUser, userSchema } from "./User"; // Importer l'interface IUser
import { IStudent } from "./Student"; // Importer l'interface IStudent
import { z } from "zod";

export interface IParent extends Omit<
  IUser,
  "password" | "memberId" | "userId " | "role"
> {
  students?: IStudent[] | null; // Liste des enfants du parent
  discount?: {
    scope: "PARENT" | "GROUP" | "ORPHAN";
    percentage: number;
    minChildren: number;
  } | null;
  role?: string; // 👈 nouveau
  memberId: string; // 👈 ajouté
  userId: string; // 👈 ajouté
}
const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/,
);

const requiredNumber = (message: string) =>
  z.preprocess(
    (value) => (value === "" || Number.isNaN(value) ? undefined : value),
    z.number({
      required_error: message,
      invalid_type_error: message,
    }),
  );

const optionalNumber = z.preprocess(
  (value) => (value === "" || Number.isNaN(value) ? undefined : value),
  z.number().optional(),
);

export const parentSchema = z.object({
  username: z.string().min(4, {
    message: "Veuillez saisir votre Code d'acces",
  }),
  name: z.string().min(3, { message: "Veuillez saisir le nom" }),
  postnom: z.string().min(3, { message: "Veuillez saisir le postnom" }),
  prenom: z.string().min(3, { message: "Veuillez saisir le prenom" }),
  dateOfBirth: z.date().optional(),
  sexe: z.string().min(4, { message: "Veuillez saisir le sexe" }),
  telephone: z.string().regex(phoneRegex, "Invalid Number!"),
  address: z.string().min(10, { message: "Veuillez saisir l'adresse" }),
  orgRole: z
    .string()
    .min(3, {
      message: "Veuillez assigner au moins un rôle",
    })
    .optional(),
  email: z.string(),
  memberId: z.string().optional(), // 👈 ajouté
  parentId: z.string().optional(), // 👈 ajouté
  // 🔥 AJOUT
  discount: z
    .object({
      scope: z.enum(["PARENT", "GROUP", "ORPHAN"]),
      percentage: requiredNumber("Veuillez saisir le pourcentage")
        .pipe(z.number().min(0).max(100)),
      minChildren: optionalNumber,
      category: z.any().optional(),
    })
    .optional(),
});
export const deleteParentSchema = z.object({
  id: z.string(),
});
