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

export type FacturePaymentStudentData = {
  invoiceNumber: string;
  sender: { name: string; address: string };
  recipient: { name: string; class: string; sexe: string };
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
  }[];
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
};

function formatBaseCell(amount: number, currency: ReceiptCurrency): string {
  if (currency === "USD") {
    return Number(amount).toFixed(2);
  }
  return Number(amount).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function generateFacturePaymentStudentPDF({
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
}: FacturePaymentStudentData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryColor = "#000000";
  const exchangeRate = exchangeRateUsdCdf;
  const schoolName = sender.name || "Établissement";
  const placeLabel = issuedPlace?.trim() || undefined;
  const base = baseCurrency;
  const secondary = resolveReceiptSecondaryCurrency(
    receivedCurrency,
    base,
    quoteCurrency,
  );
  const showSecondaryColumn = secondary != null && secondary !== base;

  const secondaryOpts = {
    exchangeRateUsdCdf: exchangeRate,
    receivedCurrency,
    baseCurrency: base,
    selectedRate,
  };

  // --- LOGO EN HAUT À DROITE ---
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, pageWidth - 38, 14, 20, 20);
    } catch {
      // Un logo invalide ne doit pas empêcher le téléchargement du reçu.
    }
  }

  // --- TITRE CENTRÉ + SOULIGNÉ ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(primaryColor);
  doc.text(schoolName, pageWidth / 2, 25, { align: "center" });
  const textWidth = doc.getTextWidth(schoolName);
  doc.setLineWidth(0.3);
  doc.line((pageWidth - textWidth) / 2, 27, (pageWidth + textWidth) / 2, 27);

  // --- INFOS FACTURE ---
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(primaryColor);
  doc.text(`Facture N°: ${invoiceNumber}`, 14, 40);

  // --- CLIENT OR STUDENT ---
  doc.text(sender.name, 14, 48);
  if (sender.address) {
    doc.text(sender.address, 14, 53);
  }
  doc.text("Noms  : " + recipient.name, 105, 48);
  doc.text("Classe: " + recipient.class, 105, 53);
  doc.text("Sexe  : " + recipient.sexe, 105, 58);

  // --- TABLEAU DES ARTICLES ---
  const startY = 60;
  const head = showSecondaryColumn
    ? [
        [
          "Description",
          "Mode",
          `Mnt a payer ${base}`,
          `Mnt payer ${base}`,
          `Mnt ${secondary}`,
        ],
      ]
    : [
        [
          "Description",
          "Mode",
          `Mnt a payer ${base}`,
          `Mnt payer ${base}`,
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
          0: { cellWidth: 70 },
          1: { halign: "right", cellWidth: 25 },
          2: { halign: "right", cellWidth: 25 },
          3: { halign: "right", cellWidth: 25 },
          4: { halign: "right", cellWidth: 30 },
        }
      : {
          0: { cellWidth: 85 },
          1: { halign: "right", cellWidth: 30 },
          2: { halign: "right", cellWidth: 30 },
          3: { halign: "right", cellWidth: 30 },
        },
    head,
    body: items.map((item) => {
      const row = [
        item.description,
        formatModePaiementLabel(item.mode ?? item.statut),
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
      return row;
    }),
    didDrawCell: (data) => {
      if (data.section === "body" || data.section === "head") {
        const x = data.cell.x;
        const y = data.cell.y;
        const height = data.cell.height;
        if (data.column.index !== data.table.columns.length - 1) {
          doc.setDrawColor(0);
          doc.setLineWidth(0.1);
          doc.line(x + data.cell.width, y, x + data.cell.width, y + height);
        }
      }
    },
  });

  const yAfterTable = (doc as any).lastAutoTable.finalY + 5;

  // --- TOTALS ---
  const totalBase = sumReceiptBase(items);
  const totalSecondary =
    showSecondaryColumn && secondary
      ? sumReceiptSecondary(items, secondary, secondaryOpts)
      : 0;
  const tableRightX = showSecondaryColumn
    ? 14 + 70 + 25 + 25 + 25 + 30
    : 14 + 85 + 30 + 30 + 30;

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

  // --- LIEU + DATE (aligné avec tableau) ---
  const currentDate = new Date().toLocaleDateString("fr-FR");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const issuedLine = placeLabel
    ? `Fait à ${placeLabel}, le ${currentDate}`
    : `Fait le ${currentDate}`;
  doc.text(issuedLine, tableRightX, nextY + 6, {
    align: "right",
  });

  // --- VÉRIFICATEUR ALIGNÉ ---
  doc.setFont("helvetica", "bold");
  doc.text("", tableRightX, nextY + 14, { align: "right" });

  doc.setLineWidth(0.3);
  doc.line(tableRightX - 45, nextY + 16, tableRightX, nextY + 16);

  // --- CADRE GLOBAL ---
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(10, 10, pageWidth - 20, nextY + 23 - 10);

  // --- SAUVEGARDE ---
  doc.save(`facture-${invoiceNumber}.pdf`);
}

export default function FacturePaymentStudent(props: FacturePaymentStudentData) {
  return generateFacturePaymentStudentPDF(props);
}
