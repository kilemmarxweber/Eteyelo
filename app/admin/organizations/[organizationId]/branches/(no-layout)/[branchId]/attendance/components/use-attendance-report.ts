"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { getAttendanceReportAction } from "../attendance-report.action";
import type {
  AttendanceReportData,
  AttendanceReportFilters,
  AttendanceReportRow,
} from "../attendance-report-types";

const EMPTY_REPORT: AttendanceReportData = {
  stats: {
    records: 0,
    presences: 0,
    absences: 0,
    checkedIn: 0,
    notCheckedIn: 0,
  },
  recent: [],
  weekdayStats: [],
  hourStats: [],
  rows: [],
};

function defaultFilters(): AttendanceReportFilters {
  const now = new Date();
  return {
    period: "month",
    month: now.getMonth(),
    year: now.getFullYear(),
    status: "ALL",
    search: "",
  };
}

function rowsToSheet(rows: AttendanceReportRow[]) {
  return rows.map((row) => ({
    Date: new Date(row.date).toLocaleDateString("fr-FR"),
    Jour: row.dayLabel,
    Agent: row.agentName,
    Matricule: row.agentId,
    Poste: row.poste,
    Statut: row.statusLabel,
    Arrivee: row.arrival ?? "",
    Depart: row.departure ?? "",
  }));
}

export function useAttendanceReport() {
  const [filters, setFilters] = useState<AttendanceReportFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AttendanceReportFilters>(defaultFilters);
  const [report, setReport] = useState<AttendanceReportData>(EMPTY_REPORT);
  const [pending, startTransition] = useTransition();

  const loadReport = useCallback((nextFilters: AttendanceReportFilters) => {
    startTransition(async () => {
      try {
        const data = await getAttendanceReportAction(nextFilters);
        setReport(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Chargement impossible.",
        );
      }
    });
  }, []);

  useEffect(() => {
    loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...filters });
  }, [filters]);

  const resetFilters = useCallback(() => {
    const next = defaultFilters();
    setFilters(next);
    setAppliedFilters(next);
  }, []);

  const exportExcel = useCallback(() => {
    if (!report.rows.length) {
      toast.error("Aucune donnee a exporter.");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rowsToSheet(report.rows));
    XLSX.utils.book_append_sheet(workbook, sheet, "Presences");
    XLSX.writeFile(workbook, "rapport-presences.xlsx");
  }, [report.rows]);

  const exportPdf = useCallback(() => {
    toast.info("Export PDF disponible via Imprimer.");
    window.print();
  }, []);

  const printReport = useCallback(() => {
    window.print();
  }, []);

  const exportActions = useMemo(
    () => ({
      exportExcel,
      exportPdf,
      printReport,
    }),
    [exportExcel, exportPdf, printReport],
  );

  return {
    filters,
    setFilters,
    report,
    pending,
    applyFilters,
    resetFilters,
    exportActions,
  };
}
