import {
  formatReceiptClasseCode,
  formatReceiptStudentName,
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
import { receiptItemStatusLabel } from "@/lib/reports/receipt-settlement";

export type ReceiptPos80BodyProps = {
  data: FacturePaymentStudentData;
  className?: string;
  issuedAt?: Date;
};

/**
 * Ticket thermique 80 mm — lignes empilées (pas de tableau large).
 * Inspiré du reçu caisse Coccinelle.
 */
export function ReceiptPos80Body({
  data,
  className,
  issuedAt = new Date(),
}: ReceiptPos80BodyProps) {
  const exchangeRate =
    data.exchangeRateUsdCdf ?? DEFAULT_EXCHANGE_RATE_USD_CDF;
  const baseCurrency = data.baseCurrency ?? "USD";
  const receivedCurrency = data.receivedCurrency ?? baseCurrency;
  const secondary =
    data.showConversion === false
      ? null
      : resolveReceiptSecondaryCurrency(
          receivedCurrency,
          baseCurrency,
          data.quoteCurrency,
        );
  const showSecondary = secondary != null && secondary !== baseCurrency;
  const secondaryOpts = {
    exchangeRateUsdCdf: exchangeRate,
    receivedCurrency,
    baseCurrency,
    selectedRate: data.selectedRate,
  };
  const totalBase = sumReceiptBase(data.items);
  const totalSecondary =
    showSecondary && secondary
      ? sumReceiptSecondary(data.items, secondary, secondaryOpts)
      : 0;
  const dateLabel = issuedAt.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div
      className={cn(
        "flex flex-col gap-2 bg-white text-[11px] leading-snug text-black",
        className,
      )}
    >
      <header className="border-b border-dashed border-black/40 pb-2 text-center">
        <p className="text-[9px] font-semibold tracking-[0.18em] uppercase">
          Reçu de paiement
        </p>
        <p className="mt-1 font-mono text-xs font-bold">
          N° {data.invoiceNumber}
        </p>
      </header>

      <dl className="space-y-1">
        <div className="flex justify-between gap-2">
          <dt className="text-black/60">Date</dt>
          <dd className="text-right tabular-nums">{dateLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-black/60">Parent</dt>
          <dd className="text-right break-words font-medium">
            {data.recipient.name || "-"}
          </dd>
        </div>
      </dl>

      <div className="border-t border-dashed border-black/40 pt-2">
        <div className="mb-1 flex justify-between text-[9px] font-semibold tracking-wide uppercase text-black/55">
          <span>Détail</span>
          <span>Payé</span>
        </div>
        <ul className="space-y-2">
          {data.items.map((item, index) => (
            <li
              key={`${item.description}-${index}`}
              className="border-b border-dotted border-black/20 pb-2 last:border-b-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 break-words font-medium">
                  {formatReceiptStudentName(item)}
                </p>
                <p className="shrink-0 tabular-nums font-semibold">
                  {formatReceiptCurrency(Number(item.montant), baseCurrency)}
                </p>
              </div>
              <p className="mt-0.5 text-[10px] text-black/60">
                {item.description}
              </p>
              <p className="mt-0.5 text-[10px] text-black/60">
                {formatModePaiementLabel(item.mode ?? item.statut)}
                {" · "}
                {formatReceiptClasseCode(item)}
              </p>
              <p className="text-[10px] text-black/60">
                À payer {formatReceiptCurrency(Number(item.price), baseCurrency)}
                {showSecondary && secondary
                  ? ` · ${formatReceiptCurrency(
                      resolveItemSecondaryAmount(item, secondary, secondaryOpts),
                      secondary,
                    )}`
                  : ""}
                {" · "}
                {receiptItemStatusLabel(item)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-0.5 border-t border-black pt-2 text-xs font-bold">
        <div className="flex justify-between gap-2">
          <span>Total {baseCurrency}</span>
          <span className="tabular-nums">
            {formatReceiptCurrency(totalBase, baseCurrency)}
          </span>
        </div>
        {showSecondary && secondary ? (
          <div className="flex justify-between gap-2">
            <span>Total {secondary}</span>
            <span className="tabular-nums">
              {formatReceiptCurrency(totalSecondary, secondary)}
            </span>
          </div>
        ) : null}
      </div>

      <p className="pt-1 text-center text-[9px] text-black/60">
        {data.issuedPlace?.trim()
          ? `Fait à ${data.issuedPlace.trim()}`
          : "Fait le"}{" "}
        {issuedAt.toLocaleDateString("fr-FR")}
      </p>
      <p className="border-t border-dashed border-black/40 pt-3 text-center text-[9px] text-black/55">
        Signature
      </p>
      <p className="text-center text-[9px] text-black/55">
        Merci · Conservez ce reçu
      </p>
    </div>
  );
}
