/** Catégories proposées pour les dépenses / sorties de fond. */
export const CASHIER_EXPENSE_CATEGORIES = [
  "Transport",
  "Achat de connexion",
  "Dépôt promoteur",
  "Paiement des personnels",
  "Paiement salaire",
  "Avance sur salaire",
  "Fournitures scolaires",
  "Entretien et maintenance",
  "Carburant",
  "Communication / téléphone",
  "Restauration",
  "Charges locatives",
  "Électricité / eau",
  "Frais bancaires",
  "Mission / déplacement",
  "Achat matériel",
  "Divers",
] as const;

const CUSTOM_CATEGORIES_STORAGE_KEY = "eteyelo:cashier-expense-categories";

export function loadCustomExpenseCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function saveCustomExpenseCategory(category: string): string[] {
  const next = category.trim();
  if (!next) return loadCustomExpenseCategories();
  const defaults = new Set(
    CASHIER_EXPENSE_CATEGORIES.map((item) => item.toLowerCase()),
  );
  if (defaults.has(next.toLowerCase())) {
    return loadCustomExpenseCategories();
  }
  const existing = loadCustomExpenseCategories();
  if (existing.some((item) => item.toLowerCase() === next.toLowerCase())) {
    return existing;
  }
  const merged = [...existing, next];
  try {
    sessionStorage.setItem(
      CUSTOM_CATEGORIES_STORAGE_KEY,
      JSON.stringify(merged),
    );
  } catch {
    // ignore quota / private mode
  }
  return merged;
}
