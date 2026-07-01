"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { FaFilePdf, FaFileExcel } from "react-icons/fa";

/* ================= TYPES ================= */

type Note = {
  studentId: string;
  nom: string;
  studentSurname: string;
  studentusername: string;
  studentSexe: string;
  score: number;
  maxScore: number;
};

type Props = {
  ficheInfo: {
    coursName: string;
    teacher: string;
    anneeName: string;
    typeFiche: string;
    periodeName: string;
    dateCreated: string;
  };
  notes: Note[];
};

/* ================= COMPONENT ================= */

export default function FicheExportActions({ ficheInfo, notes }: Props) {
  /* ================= EXPORT PDF ================= */
  const exportPDF = () => {
    const doc = new jsPDF();

    /* ===== TITRE ===== */
    doc.setFontSize(14);
    doc.text("Détails de la fiche", 14, 15);

    doc.setFontSize(10);

    /* ===== COLONNE GAUCHE ===== */
    doc.text(`Matière : ${ficheInfo.coursName}`, 14, 30);
    doc.text(`Teacher : ${ficheInfo.teacher}`, 14, 38);
    doc.text(`Année : ${ficheInfo.anneeName}`, 14, 46);

    /* ===== COLONNE DROITE ===== */
    doc.text(`Type : ${ficheInfo.typeFiche}`, 110, 30);
    doc.text(`Période : ${ficheInfo.periodeName}`, 110, 38);
    doc.text(`Date : ${ficheInfo.dateCreated}`, 110, 46);

    /* ===== TABLE NOTES ===== */
    autoTable(doc, {
      startY: 60,
      head: [["#", "Nom", "Prénom", "Username", "Sexe", "Score", "Max"]],
      body: notes.map((n, index) => [
        index + 1, // ✅ NUMÉROTATION
        n.nom,
        n.studentSurname,
        n.studentusername,
        n.studentSexe,
        n.score,
        n.maxScore,
      ]),
      styles: { fontSize: 9 },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        5: { halign: "center" },
        6: { halign: "center" },
      },
    });

    doc.save("fiche-notes.pdf");
  };

  /* ================= EXPORT EXCEL ================= */
  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      notes.map((n, index) => ({
        "#": index + 1, // ✅ NUMÉROTATION
        Nom: n.nom,
        Prénom: n.studentSurname,
        Username: n.studentusername,
        Sexe: n.studentSexe,
        Score: n.score,
        Max: n.maxScore,
      })),
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Notes");

    XLSX.writeFile(workbook, "fiche-notes.xlsx");
  };

  /* ================= UI ================= */
  return (
    <div className="flex items-center gap-2">
      {/* PDF */}
      <Button
        variant="outline"
        className="flex items-center gap-2 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={exportPDF}
      >
        <FaFilePdf className="h-4 w-4" />
        PDF
      </Button>

      {/* EXCEL */}
      <Button
        variant="outline"
        className="flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
        onClick={exportExcel}
      >
        <FaFileExcel className="h-4 w-4" />
        Excel
      </Button>
    </div>
  );
}
