/** Taux USD→CDF par défaut tant qu'aucune config branche n'existe. */
export const DEFAULT_EXCHANGE_RATE_USD_CDF = 2800;

export type SchoolReportContext = {
  organizationId: string;
  branchId: string;
  schoolName: string;
  /** Nom de la branche (sous-titre header / pied de page). */
  branchName?: string;
  address?: string;
  /** Ville de la branche (ex. « Fait à … » sur le reçu). */
  city?: string;
  phone?: string;
  logoUrl: string;
  academicYearLabel?: string;
  generatedAt: string;
  exchangeRateUsdCdf?: number;
  /** Devise de base org (fromCurrency du taux sélectionné). */
  baseCurrency?: "USD" | "CDF" | "AOA";
  /** Devise cible du taux sélectionné (ex. USD si AOA→USD). */
  quoteCurrency?: "USD" | "CDF" | "AOA";
  /** Taux sélectionné : 1 base = selectedRate quote. */
  selectedRate?: number | null;
};
