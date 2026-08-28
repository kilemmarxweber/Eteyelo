import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import {
  formatReceiptCurrency,
  formatModePaiementLabel,
  resolveItemSecondaryAmount,
  resolveReceiptSecondaryCurrency,
  sumReceiptBase,
  sumReceiptSecondary,
  type ReceiptCurrency,
} from "@/components/reports/receipt-format";
import {
  formatReceiptSettlementStatus,
  receiptItemStatusLabel,
  resolveOverallReceiptSettlementStatus,
  type ReceiptSettlementStatus,
} from "@/lib/reports/receipt-settlement";

export type FacturePaymentStudentData = {
  invoiceNumber: string;
  sender: { name: string; address: string };
  /** Parent / tuteur qui paie (nom complet). */
  recipient: { name: string; class?: string; sexe?: string };
  items: {
    description: string;
    price: number;
    /** Mode de paiement (ESPECES, MPESA, …). */
    mode: string;
    /** @deprecated Prefer `mode` — conservé pour anciens payloads. */
    statut?: string;
    /** Montant en devise de base org. */
    montant: number;
    /** Montant réellement perçu (devise reçue). */
    receivedAmount?: number;
    /** Classe de l’élève concerné par la ligne. */
    classe?: string;
    /** Code classe. */
    codeClasse?: string;
    cycle?: string | null;
    section?: string | null;
    option?: string | null;
    tranche?: string | null;
    settlementStatus?: ReceiptSettlementStatus | null;
  }[];
  /** Soldé / Acompte / Complément pour tout le reçu. */
  settlementStatus?: ReceiptSettlementStatus | null;
  /** Data URL (ou URL déjà convertie côté client) pour jsPDF. */
  logoUrl?: string;
  exchangeRateUsdCdf?: number;
  /** Ville d'émission du reçu (branche) — pas de hardcode. */
  issuedPlace?: string;
  /** Devise réellement perçue à la caisse. */
  receivedCurrency?: ReceiptCurrency;
  /** Devise de base (fromCurrency du taux sélectionné). */
  baseCurrency?: ReceiptCurrency;
  /** Devise cible du taux sélectionné. */
  quoteCurrency?: ReceiptCurrency | null;
  /** Taux sélectionné : 1 base = selectedRate quote. */
  selectedRate?: number | null;
  /** Si false, pas de colonne de conversion (2e devise) sur le reçu. */
  showConversion?: boolean;
};

export function formatReceiptClasseCode(
  item:
    | string
    | null
    | undefined
    | {
        codeClasse?: string | null;
        classe?: string | null;
        cycle?: string | null;
        section?: string | null;
        option?: string | null;
        tranche?: string | null;
      },
): string {
  if (typeof item === "string" || item == null) {
    return item?.trim() || "-";
  }
  const parts = [
    item.cycle,
    item.classe || item.codeClasse,
    item.section,
    item.option,
    item.tranche,
  ].filter((part) => Boolean(part && String(part).trim()));
  return parts.length ? parts.join(" · ") : "-";
}

function formatBaseCell(amount: number, currency: ReceiptCurrency): string {
  if (currency === "USD") {
    return Number(amount).toFixed(2);
  }
  const rounded = Math.round(Number(amount) || 0);
  return `${rounded < 0 ? "-" : ""}${String(Math.abs(rounded)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ".",
  )}`;
}

export function generateFacturePaymentStudentPDF(
  data: FacturePaymentStudentData,
  options?: { copies?: number },
) {
  const {
    invoiceNumber,
    sender,
    recipient,
    items,
    logoUrl = "",
    exchangeRateUsdCdf = DEFAULT_EXCHANGE_RATE_USD_CDF,
    issuedPlace,
    receivedCurrency = "USD",
    baseCurrency = "USD",
    quoteCurrency,
    selectedRate,
    showConversion = true,
    settlementStatus,
  } = data;
  const copies = Math.max(1, Math.round(options?.copies ?? 2));
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryColor = "#000000";
  const exchangeRate = exchangeRateUsdCdf;
  const schoolName = sender.name || "Établissement";
  const placeLabel = issuedPlace?.trim() || undefined;
  const base = baseCurrency;
  const secondary = showConversion
    ? resolveReceiptSecondaryCurrency(
        receivedCurrency,
        base,
        quoteCurrency,
      )
    : null;
  const showSecondaryColumn = secondary != null && secondary !== base;

  const secondaryOpts = {
    exchangeRateUsdCdf: exchangeRate,
    receivedCurrency,
    baseCurrency: base,
    selectedRate,
  };

  const drawCopy = () => {
    const logoSize = 20;
    const logoX = 14;
    const logoY = 12;
    let textX = logoX;

    if (logoUrl) {
      try {
        doc.addImage(logoUrl, logoX, logoY, logoSize, logoSize);
        textX = logoX + logoSize + 6;
      } catch {
        // Un logo invalide ne doit pas empêcher le téléchargement du reçu.
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(primaryColor);
    const nameY = logoY + logoSize / 2 + 1.5;
    doc.text(schoolName, textX, nameY);
    const textWidth = doc.getTextWidth(schoolName);
    doc.setLineWidth(0.3);
    doc.line(textX, nameY + 1.5, textX + textWidth, nameY + 1.5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(primaryColor);
    doc.text(`Facture N°: ${invoiceNumber}`, 14, 40);
    const overallStatus =
      settlementStatus ?? resolveOverallReceiptSettlementStatus(items);
    const statusLabel = formatReceiptSettlementStatus(overallStatus);
    if (statusLabel) {
      doc.setFont("helvetica", "bold");
      doc.text(`Statut : ${statusLabel}`, 14, 46);
      doc.setFont("helvetica", "normal");
      doc.text(`Parent : ${recipient.name || "-"}`, 14, 52);
    } else {
      doc.text(`Parent : ${recipient.name || "-"}`, 14, 46);
    }

    const startY = statusLabel ? 58 : 52;
    const head = showSecondaryColumn
      ? [
          [
            "Description",
            "Mode",
            "Cycle / Classe",
            `Mnt a payer ${base}`,
            `Mnt payer ${base}`,
            `Mnt ${secondary}`,
            "Statut",
          ],
        ]
      : [
          [
            "Description",
            "Mode",
            "Cycle / Classe",
            `Mnt a payer ${base}`,
            `Mnt payer ${base}`,
            "Statut",
          ],
        ];

    autoTable(doc, {
      startY,
      margin: { left: 14, right: 14 },
      theme: "plain",
      styles: { fontSize: 5, cellPadding: 4, textColor: "#000" },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      columnStyles: showSecondaryColumn
        ? {
            0: { cellWidth: 44 },
            1: { halign: "right", cellWidth: 20 },
            2: { cellWidth: 30 },
            3: { halign: "right", cellWidth: 22 },
            4: { halign: "right", cellWidth: 22 },
            5: { halign: "right", cellWidth: 20 },
            6: { cellWidth: 22 },
          }
        : {
            0: { cellWidth: 52 },
            1: { halign: "right", cellWidth: 24 },
            2: { cellWidth: 35 },
            3: { halign: "right", cellWidth: 26 },
            4: { halign: "right", cellWidth: 26 },
            5: { cellWidth: 24 },
          },
      head,
      body: items.map((item) => {
        const row = [
          item.description,
          formatModePaiementLabel(item.mode ?? item.statut),
          formatReceiptClasseCode(item),
          formatBaseCell(item.price, base),
          formatBaseCell(item.montant, base),
        ];
        if (showSecondaryColumn && secondary) {
          const secondaryAmount = resolveItemSecondaryAmount(
            item,
            secondary,
            secondaryOpts,
          );
          row.push(formatReceiptCurrency(secondaryAmount, secondary));
        }
        row.push(receiptItemStatusLabel(item));
        return row;
      }),
      didDrawCell: (cellData) => {
        if (cellData.section === "body" || cellData.section === "head") {
          const x = cellData.cell.x;
          const y = cellData.cell.y;
          const height = cellData.cell.height;
          if (cellData.column.index !== cellData.table.columns.length - 1) {
            doc.setDrawColor(0);
            doc.setLineWidth(0.1);
            doc.line(x + cellData.cell.width, y, x + cellData.cell.width, y + height);
          }
        }
      },
    });

    const yAfterTable = (doc as any).lastAutoTable.finalY + 5;
    const totalBase = sumReceiptBase(items);
    const totalSecondary =
      showSecondaryColumn && secondary
        ? sumReceiptSecondary(items, secondary, secondaryOpts)
        : 0;
    const tableRightX = showSecondaryColumn
      ? 14 + 44 + 20 + 30 + 22 + 22 + 20
      : 14 + 52 + 24 + 35 + 26 + 26;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Total ${base} :`, tableRightX - 45, yAfterTable);
    doc.text(formatReceiptCurrency(totalBase, base), tableRightX, yAfterTable, {
      align: "right",
    });

    let nextY = yAfterTable + 6;
    if (showSecondaryColumn && secondary) {
      doc.text(`Total ${secondary} :`, tableRightX - 45, nextY);
      doc.text(
        formatReceiptCurrency(totalSecondary, secondary),
        tableRightX,
        nextY,
        { align: "right" },
      );
      nextY += 6;
    }

    const currentDate = new Date().toLocaleDateString("fr-FR");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const issuedLine = placeLabel
      ? `Fait à ${placeLabel}, le ${currentDate}`
      : `Fait le ${currentDate}`;
    doc.text(issuedLine, tableRightX, nextY + 6, {
      align: "right",
    });

    doc.setFont("helvetica", "bold");
    doc.text("", tableRightX, nextY + 14, { align: "right" });

    doc.setLineWidth(0.3);
    doc.line(tableRightX - 45, nextY + 16, tableRightX, nextY + 16);

    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(10, 10, pageWidth - 20, nextY + 23 - 10);
  };

  for (let copy = 0; copy < copies; copy++) {
    if (copy > 0) doc.addPage();
    drawCopy();
  }

  doc.save(`facture-${invoiceNumber}.pdf`);
}

export default function FacturePaymentStudent(props: FacturePaymentStudentData) {
  return generateFacturePaymentStudentPDF(props);
}
