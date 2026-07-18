import { z } from "zod";

import { createBranchFormSchema } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/schema";

export const schoolRegistrationRequestSchema = createBranchFormSchema.extend({
  contactEmail: z
    .string()
    .trim()
    .min(1, "L'email de contact est requis.")
    .email("Adresse email invalide."),
});

export type SchoolRegistrationRequestValues = z.infer<
  typeof schoolRegistrationRequestSchema
>;
