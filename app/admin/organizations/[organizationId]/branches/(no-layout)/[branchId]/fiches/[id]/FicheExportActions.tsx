"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { FaFileExcel, FaFilePdf } from "react-icons/fa";

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

export default function FicheExportActions({ ficheInfo, notes }: Props) {
  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Détails de la fiche", 14, 15);
    doc.setFontSize(10);

    doc.text(`Matière : ${ficheInfo.coursName}`, 14, 30);
    doc.text(`Enseignant : ${ficheInfo.teacher}`, 14, 38);
    doc.text(`Année : ${ficheInfo.anneeName}`, 14, 46);

    doc.text(`Type : ${ficheInfo.typeFiche}`, 110, 30);
    doc.text(`Période : ${ficheInfo.periodeName}`, 110, 38);
    doc.text(`Date : ${ficheInfo.dateCreated}`, 110, 46);

    autoTable(doc, {
      startY: 60,
      head: [["#", "Nom", "Prénom", "Username", "Sexe", "Score", "Max"]],
      body: notes.map((n, index) => [
        index + 1,
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

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      notes.map((n, index) => ({
        "#": index + 1,
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={exportPDF}
      >
        <FaFilePdf className="size-3.5 text-red-600" />
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={exportExcel}
      >
        <FaFileExcel className="size-3.5 text-emerald-600" />
        Excel
      </Button>
    </div>
  );
}
