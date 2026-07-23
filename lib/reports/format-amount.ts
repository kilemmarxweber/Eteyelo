/**
 * Format monétaire pour rapports UI / PDF.
 * - USD : 1,234.56 USD
 * - AOA / CDF / autres : 52.500 AOA (milliers avec point, ASCII sûr pour jsPDF)
 */
export function formatReportAmount(
  value: number,
  currency: string = "USD",
): string {
  const n = Number(value);
  const amount = Number.isFinite(n) ? n : 0;
  const code = (currency || "USD").trim().toUpperCase() || "USD";

  if (code === "USD") {
    const formatted = Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${amount < 0 ? "-" : ""}${formatted} ${code}`;
  }

  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  const withDots = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${rounded < 0 ? "-" : ""}${withDots} ${code}`;
}

/** Nombre seul (sans code devise), même règles de séparateurs. */
export function formatReportNumber(
  value: number,
  currency: string = "USD",
): string {
  return formatReportAmount(value, currency).replace(
    new RegExp(`\\s+${(currency || "USD").trim().toUpperCase()}$`),
    "",
  );
}
