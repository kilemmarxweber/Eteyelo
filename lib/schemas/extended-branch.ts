import { z } from "zod";

import { BRANCH_TYPES } from "@/lib/academic-structure";
import { ISSUED_DOCUMENT_TYPES } from "@/lib/document-types";

export const branchTypeSchema = z.enum(BRANCH_TYPES, {
  required_error: "Le type de branche est requis.",
  invalid_type_error: "Le type de branche est invalide.",
});

export type BranchTypeInput = z.infer<typeof branchTypeSchema>;

export const importStudentSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(1, "L'identifiant de l'eleve est requis."),
  targetBranchId: z
    .string()
    .trim()
    .min(1, "La branche cible est requise."),
  sourceBranchId: z
    .string()
    .trim()
    .min(1, "La branche source est requise."),
});

export type ImportStudentInput = z.infer<typeof importStudentSchema>;

export const issueDocumentSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(1, "L'identifiant de l'eleve est requis."),
  branchId: z
    .string()
    .trim()
    .min(1, "La branche est requise."),
  documentType: z.enum(ISSUED_DOCUMENT_TYPES, {
    required_error: "Le type de document est requis.",
    invalid_type_error: "Le type de document est invalide.",
  }),
  title: z
    .string()
    .trim()
    .min(3, "Le titre doit contenir au moins 3 caracteres.")
    .max(200, "Le titre est trop long."),
  schoolYearId: z.string().trim().optional(),
  metadata: z.record(z.unknown()).optional(),
  pdfUrl: z.string().url("URL PDF invalide.").optional().or(z.literal("")),
});

export type IssueDocumentInput = z.infer<typeof issueDocumentSchema>;

export const searchOrganizationStudentsSchema = z.object({
  organizationId: z
    .string()
    .trim()
    .min(1, "L'organisation est requise."),
  query: z.string().trim().max(120).optional(),
  excludeBranchId: z.string().trim().optional(),
  schoolBranchOnly: z.boolean().default(true),
});

export type SearchOrganizationStudentsInput = z.infer<
  typeof searchOrganizationStudentsSchema
>;
