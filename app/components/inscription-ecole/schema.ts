import { z } from "zod";

import { createBranchFormSchema } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/schema";
import { listBranchTypesForPublicRegistration } from "@/lib/branch-capabilities";
import type { ManagedBranchType } from "@/lib/academic-structure";

const publicRegistrationBranchTypes =
  listBranchTypesForPublicRegistration() as [
    ManagedBranchType,
    ...ManagedBranchType[],
  ];

export const schoolRegistrationRequestSchema = createBranchFormSchema
  .extend({
    contactEmail: z
      .string()
      .trim()
      .min(1, "L'email de contact est requis.")
      .email("Adresse email invalide."),
    typebranch: z.enum(publicRegistrationBranchTypes, {
      required_error: "Le type d'établissement est requis.",
      invalid_type_error:
        "Ce type d'établissement ne peut pas être inscrit via ce formulaire.",
    }),
  });

export type SchoolRegistrationRequestValues = z.infer<
  typeof schoolRegistrationRequestSchema
>;
