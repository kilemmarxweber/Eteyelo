"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { IStudent } from "@/src/interfaces/Student";
import type { SchoolReportContext } from "@/lib/reports/types";
import {
  buildStudentsReportFilterLabels,
  buildStudentsReportTitle,
  exportStudentsReportPdf,
  type StudentReportOptions,
} from "./export-students-pdf";

export type StudentsListPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: IStudent[];
  context: SchoolReportContext | null;
  options?: StudentReportOptions;
};

/**
 * Aperçu HTML de la liste élèves filtrée, aligné sur le titre PDF.
 */
export function StudentsListPreviewDialog({
  open,
  onOpenChange,
  students,
  context,
  options = {},
}: StudentsListPreviewDialogProps) {
  const [downloading, setDownloading] = React.useState(false);
  const title = buildStudentsReportTitle(options);
  const filterLabels = buildStudentsReportFilterLabels(options);
  const isClassReport = Boolean(options.selectedClass);
  const generatedLabel = context?.generatedAt
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(context.generatedAt))
    : null;

  const metaParts = [
    context?.academicYearLabel
      ? `Année scolaire : ${context.academicYearLabel}`
      : null,
    generatedLabel ? `Généré le ${generatedLabel}` : null,
    ...filterLabels,
    `${students.length} élève(s)`,
  ].filter(Boolean);

  const handleDownloadPdf = async () => {
    if (!context) return;
    setDownloading(true);
    try {
      await exportStudentsReportPdf(students, context, options);
      toast.success("Le rapport PDF des élèves a été généré.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de générer le rapport PDF.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ReportPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Aperçu de la liste"
      description="Liste des élèves selon les filtres actifs"
      branding={
        context
          ? {
              schoolName: context.schoolName,
              address: context.address,
              phone: context.phone,
              logoUrl: context.logoUrl,
              academicYearLabel: context.academicYearLabel,
            }
          : undefined
      }
      documentTitle={title}
      documentSubtitle={context?.branchName}
      size="xl"
      actions={
        <Button
          type="button"
          onClick={handleDownloadPdf}
          disabled={!context || !students.length || downloading}
        >
          <Download data-icon="inline-start" />
          {downloading ? "Génération…" : "Télécharger PDF"}
        </Button>
      }
    >
      {metaParts.length ? (
        <p className="text-center text-xs text-muted-foreground">
          {metaParts.join("  ·  ")}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Matricule</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Postnom</TableHead>
              <TableHead>Prénom</TableHead>
              <TableHead>Sexe</TableHead>
              {!isClassReport ? <TableHead>Classe</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student, index) => (
              <TableRow key={student.id ?? `${student.username}-${index}`}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{student.username || "-"}</TableCell>
                <TableCell>{student.nom || "-"}</TableCell>
                <TableCell>{student.postnom || "-"}</TableCell>
                <TableCell>{student.prenom || "-"}</TableCell>
                <TableCell>{student.sexe || "-"}</TableCell>
                {!isClassReport ? (
                  <TableCell>{student.className || "Non affecté"}</TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportPreviewDialog>
  );
}
