import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { InvoiceProps } from "./PaiementsTable";

/* ----------- Fonction simple pour montant en lettres ----------- */
function numberToWords(n: number): string {
  const units = [
    "zéro",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
  ];
  if (n <= 16) return units[n];
  if (n < 20) return "dix-" + units[n - 10];
  if (n < 100) {
    const tens = [
      "",
      "",
      "vingt",
      "trente",
      "quarante",
      "cinquante",
      "soixante",
    ];
    const t = Math.floor(n / 10);
    const u = n % 10;
    return tens[t] + (u ? "-" + units[u] : "");
  }
  return n.toString(); // fallback simple
}

export function generateInvoicePDF(data: InvoiceProps) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  /* ---------------- HEADER ---------------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(data.schoolName, 15, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(data.schoolAddress, 15, 24);
  doc.text(`Tel: ${data.schoolContact}`, 15, 29);
  doc.text(data.schoolEmail, 15, 34);

  // Facture bloc droite
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`FACTURE`, pageWidth - 50, 18);

  doc.setFontSize(10);
  doc.text(`N°: ${data.invoiceNumber}`, pageWidth - 50, 25);
  doc.text(`Date: ${data.paymentDate}`, pageWidth - 50, 30);

  /* ---------------- LINE ---------------- */
  doc.setDrawColor(200);
  doc.line(15, 38, pageWidth - 15, 38);

  /* ---------------- STUDENT ---------------- */
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Détails de l'élève", 15, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nom: ${data.studentName}`, 15, 55);

  /* ---------------- TABLE ---------------- */
  autoTable(doc, {
    startY: 65,
    head: [["Frais", "Classe", "Année scolaire", "Montant payé"]],
    body: data.fees.map((f) => [
      f.nameFrais,
      f.className,
      f.schoolYear,
      `${Number(f.amountPaid).toFixed(2)} €`,
    ]),
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: 255,
      halign: "center",
    },
    columnStyles: {
      3: { halign: "right" },
    },
  });

  /* ---------------- TOTAL ---------------- */
  const total = data.fees.reduce((sum, f) => sum + Number(f.amountPaid), 0);

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", 15, finalY);

  doc.text(`${total.toFixed(2)} €`, pageWidth - 40, finalY, {
    align: "right",
  });

  /* ---------------- MONTANT EN LETTRES ---------------- */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(
    `Montant total en lettres : ${numberToWords(Math.floor(total))} euros`,
    15,
    finalY + 10,
  );

  /* ---------------- NOTE ---------------- */
  doc.setDrawColor(200);
  doc.line(15, finalY + 18, pageWidth - 15, finalY + 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Note d'avertissement", 15, finalY + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    "Ce reçu est un document officiel. Toute tentative de falsification ou d'altération est passible de poursuites judiciaires.",
    15,
    finalY + 35,
    { maxWidth: pageWidth - 30 },
  );

  doc.text(`Argent perçu par: ${data.financierName}`, 15, finalY + 45);

  /* ---------------- SIGNATURE ---------------- */
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text("Signature et cachet", pageWidth - 60, finalY + 55);

  /* ---------------- SAVE ---------------- */
  doc.save(`facture-${data.invoiceNumber}.pdf`);
}
