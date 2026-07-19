import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import {
  formatReceiptLocal,
  resolveItemLocalAmount,
  resolveReceiptLocalCurrency,
  sumReceiptLocal,
  sumReceiptUsd,
} from "@/components/reports/receipt-format";

export type FacturePaymentStudentData = {
  invoiceNumber: string;
  sender: { name: string; address: string };
  recipient: { name: string; class: string; sexe: string };
  items: {
    description: string;
    price: number;
    statut: string;
    /** Montant USD de reference. */
    montant: number;
    /** Montant reellement percu (CDF / AOA / USD). */
    receivedAmount?: number;
  }[];
  /** Data URL (ou URL déjà convertie côté client) pour jsPDF. */
  logoUrl?: string;
  exchangeRateUsdCdf?: number;
  /** Ville d'émission du reçu (branche) — pas de hardcode. */
  issuedPlace?: string;
  /** Devise reelle percue a la caisse. */
  receivedCurrency?: "USD" | "CDF" | "AOA";
};

export function generateFacturePaymentStudentPDF({
  invoiceNumber,
  sender,
  recipient,
  items,
  logoUrl = "",
  exchangeRateUsdCdf = DEFAULT_EXCHANGE_RATE_USD_CDF,
  issuedPlace,
  receivedCurrency = "USD",
}: FacturePaymentStudentData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryColor = "#000000";
  const exchangeRate = exchangeRateUsdCdf;
  const schoolName = sender.name || "Établissement";
  const placeLabel = issuedPlace?.trim() || undefined;
  const localCurrency = resolveReceiptLocalCurrency(receivedCurrency);
  const showLocalColumn =
    receivedCurrency === "CDF" ||
    receivedCurrency === "AOA" ||
    receivedCurrency === "USD";

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
  const head = showLocalColumn
    ? [["Description", "Statut", "Prix USD", "Mnt USD", `Mnt ${localCurrency}`]]
    : [["Description", "Statut", "Prix USD", "Mnt USD"]];

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
    columnStyles: showLocalColumn
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
      const montantUSD = item.montant;
      const row = [
        item.description,
        item.statut,
        item.price.toFixed(2),
        montantUSD.toFixed(2),
      ];
      if (showLocalColumn) {
        const localAmount = resolveItemLocalAmount(
          item,
          localCurrency,
          exchangeRate,
          receivedCurrency,
        );
        row.push(formatReceiptLocal(localAmount, localCurrency));
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
  const totalUSD = sumReceiptUsd(items);
  const totalLocal = sumReceiptLocal(
    items,
    localCurrency,
    exchangeRate,
    receivedCurrency,
  );
  const tableRightX = showLocalColumn
    ? 14 + 70 + 25 + 25 + 25 + 30
    : 14 + 85 + 30 + 30 + 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Total USD :", tableRightX - 45, yAfterTable);
  doc.text(`$${totalUSD.toFixed(2)}`, tableRightX, yAfterTable, {
    align: "right",
  });

  let nextY = yAfterTable + 6;
  if (showLocalColumn) {
    doc.text(`Total ${localCurrency} :`, tableRightX - 45, nextY);
    doc.text(formatReceiptLocal(totalLocal, localCurrency), tableRightX, nextY, {
      align: "right",
    });
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
