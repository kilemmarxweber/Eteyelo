import { Separator } from "@/components/ui/separator";
import type { FacturePaymentStudentData } from "@/components/FacturePaymentStudent";
import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import {
  formatReceiptLocal,
  resolveItemLocalAmount,
  resolveReceiptLocalCurrency,
  sumReceiptLocal,
  sumReceiptUsd,
} from "@/components/reports/receipt-format";

export type ReceiptPreviewBodyProps = {
  data: FacturePaymentStudentData;
  className?: string;
  /** Date affichée (défaut : aujourd’hui, comme le PDF). */
  issuedAt?: Date;
};

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
  const receivedCurrency = data.receivedCurrency ?? "USD";
  const localCurrency = resolveReceiptLocalCurrency(receivedCurrency);
  const showLocalColumn =
    receivedCurrency === "CDF" ||
    receivedCurrency === "AOA" ||
    receivedCurrency === "USD";
  const totalUsd = sumReceiptUsd(data.items);
  const totalLocal = sumReceiptLocal(
    data.items,
    localCurrency,
    exchangeRate,
    receivedCurrency,
  );
  const dateLabel = issuedAt.toLocaleDateString("fr-FR");

  return (
    <div className={cn("flex flex-col gap-4 text-sm text-foreground", className)}>
      <p className="font-medium">Facture N°: {data.invoiceNumber}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <p className="font-medium">{data.sender.name}</p>
          {data.sender.address ? (
            <p className="text-xs text-muted-foreground">{data.sender.address}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 sm:text-right">
          <p>
            <span className="text-muted-foreground">Noms : </span>
            {data.recipient.name}
          </p>
          <p>
            <span className="text-muted-foreground">Classe : </span>
            {data.recipient.class}
          </p>
          <p>
            <span className="text-muted-foreground">Sexe : </span>
            {data.recipient.sexe}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[28rem] text-left text-xs">
          <thead className="bg-foreground text-background">
            <tr>
              <th className="px-2 py-2 font-semibold">Description</th>
              <th className="px-2 py-2 text-right font-semibold">Statut</th>
              <th className="px-2 py-2 text-right font-semibold">Prix USD</th>
              <th className="px-2 py-2 text-right font-semibold">Mnt USD</th>
              {showLocalColumn ? (
                <th className="px-2 py-2 text-right font-semibold">
                  Mnt {localCurrency}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={`${item.description}-${index}`} className="border-t">
                <td className="px-2 py-2">{item.description}</td>
                <td className="px-2 py-2 text-right">{item.statut}</td>
                <td className="px-2 py-2 text-right">
                  {Number(item.price).toFixed(2)}
                </td>
                <td className="px-2 py-2 text-right">
                  {Number(item.montant).toFixed(2)}
                </td>
                {showLocalColumn ? (
                  <td className="px-2 py-2 text-right">
                    {formatReceiptLocal(
                      resolveItemLocalAmount(
                        item,
                        localCurrency,
                        exchangeRate,
                        receivedCurrency,
                      ),
                      localCurrency,
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-end gap-1 text-sm font-semibold">
        <p>
          Total USD :{" "}
          <span className="tabular-nums">${totalUsd.toFixed(2)}</span>
        </p>
        {showLocalColumn ? (
          <p>
            Total {localCurrency} :{" "}
            <span className="tabular-nums">
              {formatReceiptLocal(totalLocal, localCurrency)}
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
