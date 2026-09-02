import { Separator } from "@/components/ui/separator";
import {
  formatReceiptClasseCode,
  type FacturePaymentStudentData,
} from "@/components/FacturePaymentStudent";
import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import {
  formatReceiptCurrency,
  formatModePaiementLabel,
  resolveItemSecondaryAmount,
  resolveReceiptSecondaryCurrency,
  sumReceiptBase,
  sumReceiptSecondary,
} from "@/components/reports/receipt-format";
import {
  formatReceiptSettlementStatus,
  receiptItemStatusLabel,
  resolveOverallReceiptSettlementStatus,
} from "@/lib/reports/receipt-settlement";

export type ReceiptPreviewBodyProps = {
  data: FacturePaymentStudentData;
  className?: string;
  /** Date affichée (défaut : aujourd’hui, comme le PDF). */
  issuedAt?: Date;
};

function formatBaseCell(
  amount: number,
  currency: NonNullable<FacturePaymentStudentData["baseCurrency"]>,
): string {
  if (currency === "USD") {
    return Number(amount).toFixed(2);
  }
  const rounded = Math.round(Number(amount) || 0);
  return `${rounded < 0 ? "-" : ""}${String(Math.abs(rounded)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ".",
  )}`;
}

/**
 * Corps HTML du reçu — libellés / devises alignés sur `generateFacturePaymentStudentPDF`.
 */
export function ReceiptPreviewBody({
  data,
  className,
  issuedAt = new Date(),
}: ReceiptPreviewBodyProps) {
  const exchangeRate =
    data.exchangeRateUsdCdf ?? DEFAULT_EXCHANGE_RATE_USD_CDF;
  const baseCurrency = data.baseCurrency ?? "USD";
  const receivedCurrency = data.receivedCurrency ?? baseCurrency;
  const secondary = data.showConversion === false
    ? null
    : resolveReceiptSecondaryCurrency(
        receivedCurrency,
        baseCurrency,
        data.quoteCurrency,
      );
  const showSecondaryColumn = secondary != null && secondary !== baseCurrency;
  const secondaryOpts = {
    exchangeRateUsdCdf: exchangeRate,
    receivedCurrency,
    baseCurrency,
    selectedRate: data.selectedRate,
  };
  const totalBase = sumReceiptBase(data.items);
  const totalSecondary =
    showSecondaryColumn && secondary
      ? sumReceiptSecondary(data.items, secondary, secondaryOpts)
      : 0;
  const dateLabel = issuedAt.toLocaleDateString("fr-FR");
  const overallStatus =
    data.settlementStatus ?? resolveOverallReceiptSettlementStatus(data.items);
  const statusLabel = formatReceiptSettlementStatus(overallStatus);

  return (
    <div className={cn("flex flex-col gap-4 text-sm text-foreground", className)}>
      <div className="flex flex-col gap-1">
        <p className="font-medium">Facture N°: {data.invoiceNumber}</p>
        {statusLabel ? (
          <p>
            <span className="text-muted-foreground">Statut : </span>
            <span className="font-semibold">{statusLabel}</span>
          </p>
        ) : null}
        <p>
          <span className="text-muted-foreground">Parent : </span>
          {data.recipient.name || "-"}
        </p>
      </div>

      <div className="overflow-visible rounded-md border">
        <table className="w-full table-fixed text-left text-[10px] leading-snug sm:text-xs">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            {showSecondaryColumn ? <col className="w-[12%]" /> : null}
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-foreground text-background">
            <tr>
              <th className="px-1.5 py-2 font-semibold">Description</th>
              <th className="px-1.5 py-2 text-right font-semibold">Mode</th>
              <th className="px-1.5 py-2 font-semibold">Classe</th>
              <th className="px-1.5 py-2 text-right font-semibold">
                Mnt a payer {baseCurrency}
              </th>
              <th className="px-1.5 py-2 text-right font-semibold">
                Mnt payer {baseCurrency}
              </th>
              {showSecondaryColumn && secondary ? (
                <th className="px-1.5 py-2 text-right font-semibold">
                  Mnt {secondary}
                </th>
              ) : null}
              <th className="px-1.5 py-2 font-semibold">Statut</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={`${item.description}-${index}`} className="border-t">
                <td className="px-1.5 py-2 break-words whitespace-normal">
                  {item.description}
                </td>
                <td className="px-1.5 py-2 break-words text-right whitespace-normal">
                  {formatModePaiementLabel(item.mode ?? item.statut)}
                </td>
                <td className="px-1.5 py-2 break-words whitespace-normal">
                  {formatReceiptClasseCode(item)}
                </td>
                <td className="px-1.5 py-2 break-words text-right tabular-nums whitespace-normal">
                  {formatBaseCell(Number(item.price), baseCurrency)}
                </td>
                <td className="px-1.5 py-2 break-words text-right tabular-nums whitespace-normal">
                  {formatBaseCell(Number(item.montant), baseCurrency)}
                </td>
                {showSecondaryColumn && secondary ? (
                  <td className="px-1.5 py-2 break-words text-right tabular-nums whitespace-normal">
                    {formatReceiptCurrency(
                      resolveItemSecondaryAmount(item, secondary, secondaryOpts),
                      secondary,
                    )}
                  </td>
                ) : null}
                <td className="px-1.5 py-2 break-words font-medium whitespace-normal">
                  {receiptItemStatusLabel(item)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-end gap-1 text-sm font-semibold">
        <p>
          Total {baseCurrency} :{" "}
          <span className="tabular-nums">
            {formatReceiptCurrency(totalBase, baseCurrency)}
          </span>
        </p>
        {showSecondaryColumn && secondary ? (
          <p>
            Total {secondary} :{" "}
            <span className="tabular-nums">
              {formatReceiptCurrency(totalSecondary, secondary)}
            </span>
          </p>
        ) : null}
      </div>

      <Separator />

      <div className="flex flex-col items-end gap-4">
        <p className="text-xs text-muted-foreground">
          {data.issuedPlace?.trim()
            ? `Fait à ${data.issuedPlace.trim()}, le ${dateLabel}`
            : `Fait le ${dateLabel}`}
        </p>
        <div className="w-40 border-b border-dashed border-foreground/40 pb-6 text-center text-xs text-muted-foreground">
          Signature
        </div>
      </div>
    </div>
  );
}
