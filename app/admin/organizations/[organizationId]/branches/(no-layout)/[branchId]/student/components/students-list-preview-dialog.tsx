"use client";

import * as React from "react";
import { FileSpreadsheet, FileText, Users } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
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
import { calculateAge } from "@/lib/person-age";
import type { SchoolReportContext } from "@/lib/reports/types";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { exportStudentsReportExcel } from "./export-students-excel";
import {
  buildStudentsReportFilterLabels,
  buildStudentsReportTitle,
  exportStudentsReportPdf,
  sortStudentsForReport,
  type StudentPdfLabels,
  type StudentReportOptions,
} from "./export-students-pdf";

export type StudentsListPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: IStudent[];
  context: SchoolReportContext | null;
  options?: Omit<StudentReportOptions, "labels">;
};

export function StudentsListPreviewDialog({
  open,
  onOpenChange,
  students,
  context,
  options = {},
}: StudentsListPreviewDialogProps) {
  const [exporting, setExporting] = React.useState<"pdf" | "excel" | null>(
    null,
  );
  const locale = useLocale();
  const peopleLabels = useBranchPeopleLabels();
  const tPdf = useTranslations("users.students.pdf");
  const tTable = useTranslations("users.students.table");

  const pdfLabels: StudentPdfLabels = React.useMemo(
    () => ({
      listTitle: tPdf("listTitle", {
        studentsLower: peopleLabels.studentPluralLower,
      }),
      classTitle: tPdf("classTitle", {
        studentsLower: peopleLabels.studentPluralLower,
        className: "{className}",
      }),
      boys: tPdf("boys"),
      girls: tPdf("girls"),
      active: tPdf("active"),
      inactive: tPdf("inactive"),
      unassigned: tPdf("unassigned"),
      periodToday: tPdf("periodToday"),
      periodWeek: tPdf("periodWeek"),
      periodMonth: tPdf("periodMonth"),
      periodAll: tPdf("periodAll"),
      studentCount: tPdf("studentCount", { count: "{count}" }),
      colIndex: tPdf("colIndex"),
      colMatricule: tPdf("colMatricule"),
      colLastName: tPdf("colLastName"),
      colPostnom: tPdf("colPostnom"),
      colFirstName: tPdf("colFirstName"),
      colGender: tPdf("colGender"),
      colAge: tPdf("colAge"),
      colClass: tPdf("colClass"),
      colE13: tPdf("colE13"),
      colE80: tPdf("colE80"),
      colBirthDate: tPdf("colBirthDate"),
      colBirthPlace: tPdf("colBirthPlace"),
      filterPeriod: tPdf("filterPeriod"),
      filterYear: tPdf("filterYear"),
      filterYears: tPdf("filterYears"),
      filterClass: tPdf("filterClass"),
      filterGender: tPdf("filterGender"),
      filterStatus: tPdf("filterStatus"),
      filterSearch: tPdf("filterSearch"),
      locale,
    }),
    [locale, peopleLabels.studentPluralLower, tPdf],
  );

  const reportOptions: StudentReportOptions = React.useMemo(
    () => ({ ...options, labels: pdfLabels }),
    [options, pdfLabels],
  );

  const sortedStudents = React.useMemo(
    () => sortStudentsForReport(students, locale),
    [locale, students],
  );

  const title = buildStudentsReportTitle(reportOptions);
  const filterLabels = buildStudentsReportFilterLabels(reportOptions);
  const isClassReport = Boolean(options.selectedClass);
  const generatedLabel = context?.generatedAt
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(context.generatedAt))
    : null;

  const handleExport = async (kind: "pdf" | "excel") => {
    if (!context) return;
    setExporting(kind);
    try {
      if (kind === "excel") {
        await exportStudentsReportExcel(sortedStudents, context, reportOptions);
        toast.success(
          tPdf("generatedExcel", {
            studentsLower: peopleLabels.studentPluralLower,
          }),
        );
      } else {
        await exportStudentsReportPdf(sortedStudents, context, reportOptions);
        toast.success(
          tPdf("generated", {
            studentsLower: peopleLabels.studentPluralLower,
          }),
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : kind === "excel"
            ? tPdf("generateExcelFailed")
            : tPdf("generateFailed"),
      );
    } finally {
      setExporting(null);
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
        {tPdf("studentCount", { count: sortedStudents.length })}
      </Badge>
      {generatedLabel ? (
        <Badge variant="ghost" size="sm" className="text-muted-foreground">
          {tPdf("generatedAt", { date: generatedLabel })}
        </Badge>
      ) : null}
    </>
  );

  return (
    <ReportPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={tPdf("previewTitle")}
      description={tPdf("previewDesc")}
      branding={
        context
          ? {
              schoolName: context.schoolName,
              address: context.address,
              logoUrl: context.logoUrl,
              academicYearLabel: context.academicYearLabel,
              locale,
            }
          : undefined
      }
      documentTitle={title}
      documentSubtitle={context?.branchName}
      documentMeta={documentMeta}
      size="xl"
      paper="a4"
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            title={tTable("exportPdf")}
            aria-label={tTable("exportPdf")}
            onClick={() => void handleExport("pdf")}
            disabled={!context || !sortedStudents.length || exporting !== null}
          >
            <FileText className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title={tTable("exportExcel")}
            aria-label={tTable("exportExcel")}
            onClick={() => void handleExport("excel")}
            disabled={!context || !sortedStudents.length || exporting !== null}
          >
            <FileSpreadsheet className="size-4" />
          </Button>
        </div>
      }
    >
      {sortedStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tPdf("emptyTitle", {
            studentLower: peopleLabels.studentLower,
          })}
          description={tPdf("emptyDesc", {
            studentLower: peopleLabels.studentLower,
          })}
        />
      ) : (
        <div className="mx-auto w-full overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary hover:bg-primary">
                <TableHead className="w-12 text-center text-primary-foreground">
                  {tPdf("colIndex")}
                </TableHead>
                <TableHead className="text-primary-foreground">
                  {tPdf("colMatricule")}
                </TableHead>
                <TableHead className="text-primary-foreground">
                  {tPdf("colLastName")}
                </TableHead>
                <TableHead className="text-primary-foreground">
                  {tPdf("colPostnom")}
                </TableHead>
                <TableHead className="text-primary-foreground">
                  {tPdf("colFirstName")}
                </TableHead>
                <TableHead className="w-16 text-center text-primary-foreground">
                  {tPdf("colGender")}
                </TableHead>
                <TableHead className="w-16 text-center text-primary-foreground">
                  {tPdf("colAge")}
                </TableHead>
                {!isClassReport ? (
                  <TableHead className="text-primary-foreground">
                    {tPdf("colClass")}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStudents.map((student, index) => {
                const ageYears = calculateAge(student.dateOfBirth);
                return (
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
                    <TableCell className="text-center tabular-nums">
                      {ageYears === null ? "-" : String(ageYears)}
                    </TableCell>
                    {!isClassReport ? (
                      <TableCell>
                        {student.className || tPdf("unassigned")}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportPreviewDialog>
  );
}
