"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { FaFileExcel, FaFilePdf } from "react-icons/fa";
import type { SchoolReportContext } from "@/lib/reports/types";
import {
  exportFicheNotesReportPdf,
  type FicheNotesReportInfo,
} from "./export-fiche-notes-pdf";

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
  ficheInfo: FicheNotesReportInfo;
  notes: Note[];
  reportContext: SchoolReportContext;
};

export default function FicheExportActions({
  ficheInfo,
  notes,
  reportContext,
}: Props) {
  const [exportingPdf, setExportingPdf] = useState(false);

  const exportPDF = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportFicheNotesReportPdf(notes, reportContext, ficheInfo);
    } finally {
      setExportingPdf(false);
    }
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
        disabled={exportingPdf}
      >
        <FaFilePdf className="size-3.5 text-red-600" />
        {exportingPdf ? "PDF…" : "PDF"}
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
