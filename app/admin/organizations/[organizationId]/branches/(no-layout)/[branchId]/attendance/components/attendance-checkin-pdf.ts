"use client";

import { toast } from "sonner";
import {
  getAttendanceReportContextAction,
  getPersonnelRosterReportAction,
  getStudentRosterReportAction,
  getTeacherSessionReportAction,
} from "../attendance-exit.action";
import {
  kioskGetAttendanceReportContextAction,
  kioskGetPersonnelRosterReportAction,
  kioskGetStudentRosterReportAction,
  kioskGetTeacherSessionReportAction,
} from "@/app/attendance/[branchId]/kiosk.action";
import {
  exportPersonRosterReportPdf,
  exportTeacherSessionReportPdf,
} from "../component/export-attendance-journal-pdf";
import { buildAttendancePdfLabels } from "../attendance-pdf-labels";

function localDayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type Translate = {
  (key: string, values?: Record<string, string | number>): string;
  raw: (key: string) => unknown;
};

export async function downloadTodayAttendancePdf(options: {
  kind: "teachers" | "personnel" | "students";
  classeId?: string;
  kioskBranchId?: string;
  t: Translate;
}) {
  const day = new Date(localDayIso());
  const t = options.t;
  const labels = buildAttendancePdfLabels(t);

  const [context, contextError] = options.kioskBranchId
    ? await kioskGetAttendanceReportContextAction(options.kioskBranchId)
    : await getAttendanceReportContextAction();
  if (contextError || !context) {
    throw new Error(contextError?.message || t("reports.pdfContextFailed"));
  }

  if (options.kind === "teachers") {
    const [report, error] = options.kioskBranchId
      ? await kioskGetTeacherSessionReportAction(options.kioskBranchId, {
          startDate: day,
          endDate: day,
        })
      : await getTeacherSessionReportAction({
          startDate: day,
          endDate: day,
        });
    if (error || !report) {
      throw new Error(error?.message || t("reports.loadSessionsFailed"));
    }
    await exportTeacherSessionReportPdf(report, context, labels);
    toast.success(t("reports.sessionsPdfSuccess"));
    return;
  }

  if (options.kind === "personnel") {
    const [report, error] = options.kioskBranchId
      ? await kioskGetPersonnelRosterReportAction(options.kioskBranchId, {
          startDate: day,
          endDate: day,
        })
      : await getPersonnelRosterReportAction({
          startDate: day,
          endDate: day,
        });
    if (error || !report) {
      throw new Error(error?.message || t("reports.loadPersonnelFailed"));
    }
    await exportPersonRosterReportPdf(report, context, labels, {
      title: t("pdf.personnelRosterTitle"),
      filePrefix: "rapport-presence-personnel",
    });
    toast.success(t("reports.personnelPdfSuccess"));
    return;
  }

  const [report, error] = options.kioskBranchId
    ? await kioskGetStudentRosterReportAction(options.kioskBranchId, {
        startDate: day,
        endDate: day,
        classeId: options.classeId ?? null,
      })
    : await getStudentRosterReportAction({
        startDate: day,
        endDate: day,
        classeId: options.classeId ?? null,
      });
  if (error || !report) {
    throw new Error(error?.message || t("reports.loadStudentsFailed"));
  }
  await exportPersonRosterReportPdf(report, context, labels, {
    title: t("pdf.studentRosterTitle"),
    filePrefix: "rapport-presence-eleves",
  });
  toast.success(t("reports.studentsPdfSuccess"));
}
