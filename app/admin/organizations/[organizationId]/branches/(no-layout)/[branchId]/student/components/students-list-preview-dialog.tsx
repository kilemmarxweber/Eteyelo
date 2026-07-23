"use client";

import * as React from "react";
import { Download, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
 * Aperçu HTML de la liste élèves filtrée, aligné sur le PDF A4 portrait.
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

  const documentMeta = (
    <>
      {filterLabels.map((label) => (
        <Badge key={label} variant="secondary" size="sm">
          {label}
        </Badge>
      ))}
      <Badge variant="outline" size="sm">
        {students.length} élève{students.length > 1 ? "s" : ""}
      </Badge>
      {generatedLabel ? (
        <Badge variant="ghost" size="sm" className="text-muted-foreground">
          Généré le {generatedLabel}
        </Badge>
      ) : null}
    </>
  );

  return (
    <ReportPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Aperçu du rapport"
      description="Format A4 portrait — tel qu’il sera exporté en PDF"
      branding={
        context
          ? {
              schoolName: context.schoolName,
              address: context.address,
              logoUrl: context.logoUrl,
              academicYearLabel: context.academicYearLabel,
            }
          : undefined
      }
      documentTitle={title}
      documentSubtitle={context?.branchName}
      documentMeta={documentMeta}
      size="xl"
      paper="a4"
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
      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun élève"
          description="Aucun élève ne correspond aux filtres actifs."
        />
      ) : (
        <div className="mx-auto w-full overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary hover:bg-primary">
                <TableHead className="w-12 text-center text-primary-foreground">
                  #
                </TableHead>
                <TableHead className="text-primary-foreground">
                  Matricule
                </TableHead>
                <TableHead className="text-primary-foreground">Nom</TableHead>
                <TableHead className="text-primary-foreground">
                  Postnom
                </TableHead>
                <TableHead className="text-primary-foreground">
                  Prénom
                </TableHead>
                <TableHead className="w-16 text-center text-primary-foreground">
                  Sexe
                </TableHead>
                {!isClassReport ? (
                  <TableHead className="text-primary-foreground">
                    Classe
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student, index) => (
                <TableRow
                  key={student.id ?? `${student.username}-${index}`}
                  className="odd:bg-muted/40"
                >
                  <TableCell className="text-center text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {student.username || "-"}
                  </TableCell>
                  <TableCell>{student.nom || "-"}</TableCell>
                  <TableCell>{student.postnom || "-"}</TableCell>
                  <TableCell>{student.prenom || "-"}</TableCell>
                  <TableCell className="text-center">
                    {student.sexe || "-"}
                  </TableCell>
                  {!isClassReport ? (
                    <TableCell>{student.className || "Non affecté"}</TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportPreviewDialog>
  );
}
