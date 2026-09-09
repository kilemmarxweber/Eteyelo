"use client";

import { toast } from "sonner";
import {
  getAttendanceReportContextAction,
  getPersonnelRosterReportAction,
  getStudentRosterReportAction,
  getTeacherSessionReportAction,
  type PersonRosterReport,
  type TeacherSessionReport,
} from "../attendance-exit.action";
import type { SchoolReportContext } from "@/lib/reports/types";
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

  const context = await loadReportContext(options.kioskBranchId, t);

  if (options.kind === "teachers") {
    const report = options.kioskBranchId
      ? await kioskGetTeacherSessionReportAction(options.kioskBranchId, {
          startDate: day,
          endDate: day,
        })
      : await unwrapReport<TeacherSessionReport>(
          getTeacherSessionReportAction({
            startDate: day,
            endDate: day,
          }),
          t("reports.loadSessionsFailed"),
        );
    await exportTeacherSessionReportPdf(report, context, labels);
    toast.success(t("reports.sessionsPdfSuccess"));
    return;
  }

  if (options.kind === "personnel") {
    const report = options.kioskBranchId
      ? await kioskGetPersonnelRosterReportAction(options.kioskBranchId, {
          startDate: day,
          endDate: day,
        })
      : await unwrapReport<PersonRosterReport>(
          getPersonnelRosterReportAction({
            startDate: day,
            endDate: day,
          }),
          t("reports.loadPersonnelFailed"),
        );
    await exportPersonRosterReportPdf(report, context, labels, {
      title: t("pdf.personnelRosterTitle"),
      filePrefix: "rapport-presence-personnel",
    });
    toast.success(t("reports.personnelPdfSuccess"));
    return;
  }

  const report = options.kioskBranchId
    ? await kioskGetStudentRosterReportAction(options.kioskBranchId, {
        startDate: day,
        endDate: day,
        classeId: options.classeId ?? null,
      })
    : await unwrapReport<PersonRosterReport>(
        getStudentRosterReportAction({
          startDate: day,
          endDate: day,
          classeId: options.classeId ?? null,
        }),
        t("reports.loadStudentsFailed"),
      );
  await exportPersonRosterReportPdf(report, context, labels, {
    title: t("pdf.studentRosterTitle"),
    filePrefix: "rapport-presence-eleves",
  });
  toast.success(t("reports.studentsPdfSuccess"));
}

async function loadReportContext(kioskBranchId: string | undefined, t: Translate) {
  if (kioskBranchId) {
    return kioskGetAttendanceReportContextAction(kioskBranchId);
  }
  return unwrapReport<SchoolReportContext>(
    getAttendanceReportContextAction(),
    t("reports.pdfContextFailed"),
  );
}

async function unwrapReport<T>(result: Promise<unknown>, fallback: string): Promise<T> {
  const [data, error] = (await result) as [
    T | null,
    { message?: string } | null,
  ];
  if (error || !data) {
    throw new Error(error?.message || fallback);
  }
  return data;
}
