import { z } from "zod";

export const rentreeProgramItemSchema = z.object({
  date: z.string().trim().min(1, "Date requise"),
  title: z.string().trim().min(2, "Titre requis"),
  description: z.string().trim().optional().or(z.literal("")),
});

export type RentreeProgramItem = z.infer<typeof rentreeProgramItemSchema>;

export type PublicBranchRegistrationInfo = {
  id: string;
  branchId: string;
  branchName: string;
  schoolYearName: string | null;
  termsTitle: string;
  termsContent: string;
  registrationFeeRequired: boolean;
  registrationFeeAmount: number | null;
  registrationFeeCurrency: string;
  registrationFeeLabel: string | null;
  registrationFeeDueNote: string | null;
  rentreeProgram: RentreeProgramItem[];
};

export function parseRentreeProgram(value: unknown): RentreeProgramItem[] {
  if (!Array.isArray(value)) return [];
  const items: RentreeProgramItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const date = typeof row.date === "string" ? row.date.trim() : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const description =
      typeof row.description === "string" ? row.description.trim() : "";
    if (!date || !title) continue;
    items.push({ date, title, description });
  }
  return items;
}

export function formatRegistrationFee(
  amount: number | null,
  currency: string,
) {
  if (amount == null) return null;
  const code =
    currency === "USD" || currency === "AOA" || currency === "CDF"
      ? currency
      : "CDF";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}
