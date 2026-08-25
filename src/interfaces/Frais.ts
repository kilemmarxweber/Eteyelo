import z from "zod";
import { IClasse } from "./Classe";

export interface ITypeFrais {
  id: string;
  codeType: string;
  nameType: string;
  description?: string;
  cycle?: string | null;
  statusType: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFrais {
  id: string;
  nameFrais: string;
  montantFrais: number;
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
  codeType: z.string().trim().optional().or(z.literal("")),
  nameType: z.string().min(3, { message: "Nom requis (min 3 caracteres)" }),
  description: z.string().optional(),
  statusType: z.boolean().optional(),
  cycle: z
    .enum(["MATERNELLE", "PRIMAIRE", "SECONDAIRE"])
    .optional()
    .nullable(),
});

export const fraisSchema = z.object({
  id: z.string().optional(),
  nameFrais: z.string().min(4, { message: "Veuillez saisir le nom du frais" }),
  montantFrais: z
    .number()
    .min(0.01, { message: "Le montant doit etre superieur a 0" }),
  statusFrais: z.boolean().optional(),
  classeId: z.string().min(1, { message: "Classe requise" }),
  typeFraisId: z.string().min(1, { message: "Type de frais requis" }),
  echeance: z.date().optional(),
  priority: z.number().optional(),
  schoolYearId: z.string().optional(),
  semesterId: z.coerce.number().int().positive().optional().nullable(),
  applyToCycle: z.boolean().optional(),
  applyToLevel: z.boolean().optional(),
});

export const deleteFraisSchema = z.object({
  id: z.string(),
});

export const replicateFraisSchema = z
  .object({
    sourceClasseId: z.string().min(1),
    fraisIds: z.array(z.string().min(1)).optional(),
    targetClasseIds: z.array(z.string().min(1)).optional(),
    allOtherClasses: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.allOtherClasses === true ||
      (value.targetClasseIds && value.targetClasseIds.length > 0),
    { message: "Sélectionnez au moins une classe" },
  );
