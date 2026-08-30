"use client";

import * as React from "react";
import { Download, Users } from "lucide-react";
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
import type { SchoolReportContext } from "@/lib/reports/types";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import {
  buildStudentsReportFilterLabels,
  buildStudentsReportTitle,
  exportStudentsReportPdf,
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
  const [downloading, setDownloading] = React.useState(false);
  const locale = useLocale();
  const peopleLabels = useBranchPeopleLabels();
  const tPdf = useTranslations("users.students.pdf");

  const pdfLabels: StudentPdfLabels = React.useMemo(
    () => ({
      listTitle: tPdf("listTitle", {
        studentsLower: peopleLabels.studentPluralLower,
      }),
      classTitle: tPdf("classTitle", { className: "{className}" }),
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

  const title = buildStudentsReportTitle(reportOptions);
  const filterLabels = buildStudentsReportFilterLabels(reportOptions);
  const isClassReport = Boolean(options.selectedClass);
  const generatedLabel = context?.generatedAt
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(context.generatedAt))
    : null;

  const handleDownloadPdf = async () => {
    if (!context) return;
    setDownloading(true);
    try {
      await exportStudentsReportPdf(students, context, reportOptions);
      toast.success(
        tPdf("generated", {
          studentsLower: peopleLabels.studentPluralLower,
        }),
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : tPdf("generateFailed"),
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
        {tPdf("studentCount", { count: students.length })}
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
          {downloading ? tPdf("generating") : tPdf("downloadPdf")}
        </Button>
      }
    >
      {students.length === 0 ? (
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
                {!isClassReport ? (
                  <TableHead className="text-primary-foreground">
                    {tPdf("colClass")}
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
                    <TableCell>
                      {student.className || tPdf("unassigned")}
                    </TableCell>
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
