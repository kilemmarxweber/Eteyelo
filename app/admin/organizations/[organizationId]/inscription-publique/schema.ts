import { z } from "zod";

export const FEE_CURRENCIES = ["CDF", "USD", "AOA"] as const;
export type FeeCurrency = (typeof FEE_CURRENCIES)[number];

export function toFeeCurrency(value: string | null | undefined): FeeCurrency {
  if (value && (FEE_CURRENCIES as readonly string[]).includes(value)) {
    return value as FeeCurrency;
  }
  return "CDF";
}

export const rentreeProgramItemSchema = z.object({
  date: z.string().trim().min(1, "Date requise"),
  title: z.string().trim().min(2, "Titre requis"),
  description: z.string().trim().optional().or(z.literal("")),
});

export const branchRegistrationInfoFormSchema = z
  .object({
    id: z.string().optional(),
    branchId: z.string().min(1, "Ecole requise"),
    schoolYearId: z.string().optional().or(z.literal("")),
    isPublished: z.boolean(),
    termsTitle: z.string().trim().min(2, "Titre des conditions requis"),
    termsContent: z
      .string()
      .trim()
      .min(20, "Les conditions doivent contenir au moins 20 caracteres"),
    registrationFeeRequired: z.boolean(),
    registrationFeeAmount: z.string().optional().or(z.literal("")),
    registrationFeeCurrency: z.enum(FEE_CURRENCIES, {
      message: "Devise requise",
    }),
    registrationFeeLabel: z.string().trim().optional().or(z.literal("")),
    registrationFeeDueNote: z.string().trim().optional().or(z.literal("")),
    rentreeProgram: z.array(rentreeProgramItemSchema),
  })
  .superRefine((value, ctx) => {
    if (!value.registrationFeeRequired) return;
    const amount = Number(value.registrationFeeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registrationFeeAmount"],
        message: "Indiquez un montant de frais d'inscription valide.",
      });
    }
  });

export type BranchRegistrationInfoFormValues = z.infer<
  typeof branchRegistrationInfoFormSchema
>;
