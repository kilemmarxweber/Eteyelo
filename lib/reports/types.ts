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
};
