import z from "zod";
import { IClasse } from "./Classe";
import { ISchoolYear } from "./SchoolYear";

export interface ITypeFrais {
  id: string;
  codeType: string;
  nameType: string;
  description?: string;
  statusType: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFrais {
  id: string;
  nameFrais: string;
  montantFrais: number; // Will be converted from Decimal
  classeId: string;
  typeFraisId?: string;
  echeance?: Date;
  Classe?: IClasse;
  typeFrais?: ITypeFrais;
  priority?: number;
  schoolYearId: string;
  schoolYear?: {
    id: string;
    nameSchoolYear: string;
  };
  statusFrais: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const typeFraisSchema = z.object({
  id: z.string().optional(),
  codeType: z.string().min(2, { message: "Code requis (min 2 caractères)" }),
  nameType: z.string().min(3, { message: "Nom requis (min 3 caractères)" }),
  description: z.string().optional(),
  statusType: z.boolean().optional(),
});

export const fraisSchema = z.object({
  id: z.string().optional(),
  nameFrais: z.string().min(4, { message: "Veuillez saisir le nom du frais" }),
  montantFrais: z
    .number()
    .min(0.01, { message: "Le montant doit être supérieur à 0" }),
  statusFrais: z.boolean().optional(),
  classeId: z.string().min(1, { message: "Classe requise" }),
  typeFraisId: z.string().optional(), // ✅ optionnel
  echeance: z.date().optional(),
  priority: z.number().optional(),
  schoolYearId: z.string().optional(),
});
// frais.schema.ts

export const deleteFraisSchema = z.object({
  id: z.string(),
});
