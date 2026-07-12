import { z } from "zod";

const personSchema = z.object({
  username: z.string().trim().min(4, "Code d'accès requis").optional(),
  name: z.string().trim().min(2, "Nom requis"),
  postnom: z.string().trim().min(2, "Postnom requis"),
  prenom: z.string().trim().min(2, "Prénom requis"),
  email: z.string().trim().email("Adresse email invalide"),
  telephone: z.string().trim().min(7, "Téléphone requis").optional(),
  sexe: z.enum(["masculin", "feminin"]),
  address: z.string().trim().min(5, "Adresse requise"),
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
        email: z.string().trim().email("Adresse email invalide").optional(),
        telephone: z.string().trim().optional(),
        dateOfBirth: z.coerce.date(),
        category: z.enum(["NORMAL", "ORPHAN", "VIP", "SPONSORED", "GROUPE"]).default("NORMAL"),
        observation: z.string().trim().optional(),
        provenanceEcole: z.string().trim().optional(),
        placeOfBirth: z.string().trim().optional(),
      })
      .optional(),
    parentMode: z.enum(["existing", "new"]),
    parentId: z.string().optional(),
    parent: personSchema.extend({
      discountPercentage: z.number().min(0).max(100).default(0),
    }).optional(),
    historyOutcome: z.enum(["new", "passed", "failed", "returning"]),
  })
  .superRefine((value, ctx) => {
    if (value.studentMode === "existing" && !value.studentId)
      ctx.addIssue({ code: "custom", path: ["studentId"], message: "Élève requis" });
    if (value.studentMode === "new" && !value.student)
      ctx.addIssue({ code: "custom", path: ["student"], message: "Informations de l'élève requises" });
    if (value.parentMode === "existing" && !value.parentId)
      ctx.addIssue({ code: "custom", path: ["parentId"], message: "Parent requis" });
    if (value.parentMode === "new" && !value.parent)
      ctx.addIssue({ code: "custom", path: ["parent"], message: "Informations du parent requises" });
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
