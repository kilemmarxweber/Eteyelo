import { z } from "zod";

import { isCentreFormationBranch } from "@/lib/branch-capabilities";

const optionalEmailSchema = z.union([
  z.literal(""),
  z.string().trim().email("Adresse email invalide"),
]);

const personSchema = z.object({
  username: z.string().trim().min(4, "Code d'accès requis").optional(),
  name: z.string().trim().min(2, "Nom requis"),
  postnom: z.string().trim().min(2, "Postnom requis"),
  prenom: z.string().trim().min(2, "Prénom requis"),
  email: optionalEmailSchema.optional(),
  telephone: z.string().trim().optional().or(z.literal("")),
  sexe: z.enum(["masculin", "feminin"]),
  address: z.string().trim().optional().or(z.literal("")),
  dateOfBirth: z.coerce.date().optional(),
});

export const registrationSchema = z
  .object({
    requestId: z.string().optional(),
    schoolYearId: z.string().min(1, "Année scolaire requise"),
    level: z.string().min(1, "Niveau requis"),
    optionId: z.string().optional(),
    studentMode: z.enum(["existing", "new"]),
    studentId: z.string().optional(),
    student: personSchema
      .extend({
        username: z.string().optional(),
        email: optionalEmailSchema.optional(),
        telephone: z.string().trim().optional().or(z.literal("")),
        /** Adresse élève — facultative */
        address: z.string().trim().optional().or(z.literal("")),
        dateOfBirth: z.coerce.date(),
        category: z.enum(["NORMAL", "ORPHAN", "VIP", "SPONSORED", "GROUPE"]).default("NORMAL"),
        observation: z.string().trim().optional(),
        provenanceEcole: z.string().trim().optional(),
        placeOfBirth: z.string().trim().optional(),
        nationalite: z.string().trim().max(120).optional().or(z.literal("")),
        autreNationalite: z.string().trim().max(120).optional().or(z.literal("")),
        territoireAutreNationalite: z
          .string()
          .trim()
          .max(120)
          .optional()
          .or(z.literal("")),
        langue: z.string().trim().max(120).optional().or(z.literal("")),
      })
      .optional(),
    parentMode: z.enum(["existing", "new"]),
    parentId: z.string().optional(),
    parent: personSchema.extend({
      /** Adresse parent — toujours requise */
      address: z.string().trim().min(1, "Adresse requise"),
      /** Email facultatif : généré côté serveur si vide */
      email: optionalEmailSchema.optional(),
      /** Téléphone parent — facultatif */
      telephone: z.string().trim().optional().or(z.literal("")),
      discountPercentage: z.number().min(0).max(100).default(0),
      /** Type de frais concerné par la remise (requis si remise > 0) */
      discountTypeFraisId: z.string().optional().or(z.literal("")),
      /** Fonction / lieu de travail — optionnel */
      profession: z.string().trim().max(200).optional().or(z.literal("")),
      nomMere: z.string().trim().max(200).optional().or(z.literal("")),
      professionMere: z.string().trim().max(200).optional().or(z.literal("")),
      tuteurNom: z.string().trim().max(200).optional().or(z.literal("")),
      adresseTuteur: z.string().trim().max(300).optional().or(z.literal("")),
      provinceOrigine: z.string().trim().max(120).optional().or(z.literal("")),
      territoireOrigine: z.string().trim().max(120).optional().or(z.literal("")),
      secteurOrigine: z.string().trim().max(120).optional().or(z.literal("")),
      villageOrigine: z.string().trim().max(120).optional().or(z.literal("")),
    }).optional(),
    historyOutcome: z.enum(["new", "passed", "failed", "returning"]),
    photoUrl: z.string().trim().min(1).optional().or(z.literal("")),
    studentExtra: z
      .object({
        nationalite: z.string().trim().max(120).optional().or(z.literal("")),
        autreNationalite: z.string().trim().max(120).optional().or(z.literal("")),
        territoireAutreNationalite: z
          .string()
          .trim()
          .max(120)
          .optional()
          .or(z.literal("")),
        langue: z.string().trim().max(120).optional().or(z.literal("")),
      })
      .optional(),
    familyExtra: z
      .object({
        nomMere: z.string().trim().max(200).optional().or(z.literal("")),
        professionMere: z.string().trim().max(200).optional().or(z.literal("")),
        tuteurNom: z.string().trim().max(200).optional().or(z.literal("")),
        adresseTuteur: z.string().trim().max(300).optional().or(z.literal("")),
        provinceOrigine: z.string().trim().max(120).optional().or(z.literal("")),
        territoireOrigine: z
          .string()
          .trim()
          .max(120)
          .optional()
          .or(z.literal("")),
        secteurOrigine: z.string().trim().max(120).optional().or(z.literal("")),
        villageOrigine: z.string().trim().max(120).optional().or(z.literal("")),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.studentMode === "existing" && !value.studentId)
      ctx.addIssue({ code: "custom", path: ["studentId"], message: "Élève requis" });
    if (value.studentMode === "new" && !value.student)
      ctx.addIssue({ code: "custom", path: ["student"], message: "Informations de l'élève requises" });
    if (
      value.parentMode === "new" &&
      value.parent &&
      value.parent.discountPercentage > 0 &&
      !value.parent.discountTypeFraisId?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["parent", "discountTypeFraisId"],
        message: "Choisissez le type de frais concerné par la remise",
      });
    }
  });

export function validateRegistrationParentInput(
  typebranch: unknown,
  value: Pick<
    z.infer<typeof registrationSchema>,
    "parentMode" | "parentId" | "parent"
  >,
): string | null {
  if (isCentreFormationBranch(typebranch)) {
    return null;
  }

  if (value.parentMode === "existing" && !value.parentId) {
    return "Parent requis";
  }

  if (value.parentMode === "new" && !value.parent) {
    return "Informations du parent requises";
  }

  return null;
}

export type RegistrationInput = z.infer<typeof registrationSchema>;
