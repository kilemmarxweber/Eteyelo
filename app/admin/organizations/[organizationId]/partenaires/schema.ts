import { z } from "zod";

export const createPartenaireSchema = z.object({
  name: z.string().trim().min(2, "Le nom est requis."),
  slug: z.string().trim().optional(),
  type: z.string().trim().optional(),
  secteur: z.string().trim().optional(),
  description: z.string().trim().optional(),
  image: z.string().trim().min(1, "L’image est requise."),
  logo: z.string().trim().optional(),
  tel: z.string().trim().min(1, "Le téléphone est requis."),
  email: z
    .string()
    .trim()
    .email("Email invalide.")
    .optional()
    .or(z.literal("")),
  website: z.string().trim().optional(),
  adresse: z.string().trim().optional(),
  ville: z.string().trim().optional(),
  pays: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  contactRole: z.string().trim().optional(),
  documentUrl: z.string().trim().optional(),
  contractRef: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  branchId: z.string().trim().optional(),
  isActive: z.coerce.boolean(),
  isFeatured: z.coerce.boolean(),
});

export type CreatePartenaireInput = z.infer<typeof createPartenaireSchema>;
