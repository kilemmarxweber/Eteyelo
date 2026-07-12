import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { IStudent } from "@/src/interfaces/Student";

function ageFromBirthDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return "-";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    age -= 1;
  return age >= 0 ? String(age) : "-";
}

export function buildStudentsReportPdf(students: IStudent[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const generatedAt = new Date().toLocaleString("fr-FR");

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, 297, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Rapport des eleves", 14, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${students.length} eleve(s) - Genere le ${generatedAt}`, 14, 18);

  autoTable(doc, {
    startY: 30,
    head: [
      [
        "#",
        "Matricule",
        "Nom complet",
        "Sexe",
        "Age",
        "Lieu de naissance",
        "Code classe",
        "Classe",
      ],
    ],
    body: students.map((student, index) => [
      index + 1,
      student.username || "-",
      [student.nom, student.postnom, student.prenom].filter(Boolean).join(" "),
      student.sexe || "-",
      ageFromBirthDate(student.dateOfBirth),
      student.placeOfBirth || "-",
      student.classCode || "-",
      student.className || "Non inscrit",
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.2,
      overflow: "linebreak",
    },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 34 },
      2: { cellWidth: 55 },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 13, halign: "center" },
      5: { cellWidth: 42 },
      6: { cellWidth: 30 },
      7: { cellWidth: 42 },
    },
    didDrawPage: ({ pageNumber }) => {
      doc.setTextColor(100);
      doc.setFontSize(8);
      doc.text(`Page ${pageNumber}`, 283, 202, { align: "right" });
    },
  });

  return doc;
}

export function exportStudentsReportPdf(students: IStudent[]) {
  const date = new Date().toISOString().slice(0, 10);
  buildStudentsReportPdf(students).save(`liste-eleves-${date}.pdf`);
}
