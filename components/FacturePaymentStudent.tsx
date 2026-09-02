import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import {
  formatReceiptCurrency,
  formatModePaiementLabel,
  parseReceiptPrintFormat,
  resolveItemSecondaryAmount,
  resolveReceiptSecondaryCurrency,
  sumReceiptBase,
  sumReceiptSecondary,
  type ReceiptCurrency,
  type ReceiptPrintFormat,
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
  /** Modèle d'impression : A4 (tableau) ou ticket POS 80 mm. */
  receiptPrintFormat?: "A4" | "POS_80MM";
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

function generateFacturePaymentStudentPosPDF(
  data: FacturePaymentStudentData,
  copies: number,
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
  const pageWidth = 80;
  const margin = 4;
  const contentWidth = pageWidth - margin * 2;
  const lineH = 4.2;
  const itemBlock = 14;
  const headerH = 42;
  const pageHeight = Math.max(120, headerH + items.length * itemBlock + 36);
  const doc = new jsPDF({
    unit: "mm",
    format: [pageWidth, pageHeight],
  });
  const base = baseCurrency;
  const secondary = showConversion
    ? resolveReceiptSecondaryCurrency(receivedCurrency, base, quoteCurrency)
    : null;
  const showSecondary = secondary != null && secondary !== base;
  const secondaryOpts = {
    exchangeRateUsdCdf,
    receivedCurrency,
    baseCurrency: base,
    selectedRate,
  };
  const totalBase = sumReceiptBase(items);
  const totalSecondary =
    showSecondary && secondary
      ? sumReceiptSecondary(items, secondary, secondaryOpts)
      : 0;
  const dateLabel = new Date().toLocaleDateString("fr-FR");
  const schoolName = sender.name || "Établissement";
  const overallStatus =
    settlementStatus ?? resolveOverallReceiptSettlementStatus(items);
  const statusLabel = formatReceiptSettlementStatus(overallStatus);

  const drawCopy = () => {
    let y = 6;
    if (logoUrl) {
      try {
        doc.addImage(logoUrl, pageWidth / 2 - 8, y, 16, 16);
        y += 18;
      } catch {
        // logo invalide : continuer sans image
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const nameLines = doc.splitTextToSize(schoolName, contentWidth);
    doc.text(nameLines, pageWidth / 2, y, { align: "center" });
    y += nameLines.length * 4 + 2;

    if (sender.address?.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const addrLines = doc.splitTextToSize(sender.address.trim(), contentWidth);
      doc.text(addrLines, pageWidth / 2, y, { align: "center" });
      y += addrLines.length * 3.2 + 2;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("REÇU DE PAIEMENT", pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFontSize(9);
    doc.text(`N° ${invoiceNumber}`, pageWidth / 2, y, { align: "center" });
    y += 5;
    if (statusLabel) {
      doc.text(statusLabel, pageWidth / 2, y, { align: "center" });
      y += 4;
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Parent : ${recipient.name || "-"}`, margin, y);
    y += lineH;
    const issuedLine = issuedPlace?.trim()
      ? `Fait à ${issuedPlace.trim()}, le ${dateLabel}`
      : `Fait le ${dateLabel}`;
    const issuedLines = doc.splitTextToSize(issuedLine, contentWidth);
    doc.text(issuedLines, margin, y);
    y += issuedLines.length * 3.5 + 2;

    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    for (const item of items) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const desc = doc.splitTextToSize(item.description, contentWidth - 28);
      doc.text(desc, margin, y);
      doc.text(
        formatReceiptCurrency(Number(item.montant), base),
        pageWidth - margin,
        y,
        { align: "right" },
      );
      y += desc.length * 3.4 + 0.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const meta = `${formatModePaiementLabel(item.mode ?? item.statut)} · ${formatReceiptClasseCode(item)} · ${receiptItemStatusLabel(item)}`;
      const metaLines = doc.splitTextToSize(meta, contentWidth);
      doc.text(metaLines, margin, y);
      y += metaLines.length * 3.1;
      doc.text(
        `À payer ${formatReceiptCurrency(Number(item.price), base)}`,
        margin,
        y,
      );
      y += 3.2;
      if (showSecondary && secondary) {
        doc.text(
          formatReceiptCurrency(
            resolveItemSecondaryAmount(item, secondary, secondaryOpts),
            secondary,
          ),
          margin,
          y,
        );
        y += 3.2;
      }
      y += 1.5;
    }

    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Total ${base}`, margin, y);
    doc.text(formatReceiptCurrency(totalBase, base), pageWidth - margin, y, {
      align: "right",
    });
    y += 5;
    if (showSecondary && secondary) {
      doc.text(`Total ${secondary}`, margin, y);
      doc.text(
        formatReceiptCurrency(totalSecondary, secondary),
        pageWidth - margin,
        y,
        { align: "right" },
      );
      y += 5;
    }

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Signature", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.text("Merci · Conservez ce reçu", pageWidth / 2, y, {
      align: "center",
    });
  };

  for (let copy = 0; copy < copies; copy++) {
    if (copy > 0) doc.addPage([pageWidth, pageHeight], "portrait");
    drawCopy();
  }

  doc.save(`facture-${invoiceNumber}-pos80.pdf`);
}

export function generateFacturePaymentStudentPDF(
  data: FacturePaymentStudentData,
  options?: { copies?: number; format?: ReceiptPrintFormat },
) {
  const copies = Math.max(1, Math.round(options?.copies ?? 1));
  const format = parseReceiptPrintFormat(
    options?.format ?? data.receiptPrintFormat,
  );
  if (format === "POS_80MM") {
    generateFacturePaymentStudentPosPDF(data, copies);
    return;
  }

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
