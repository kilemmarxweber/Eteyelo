"use client";

import { AttendanceDetailTable } from "./attendance-detail-table";
import { AttendanceFilters } from "./attendance-filters";
import { AttendanceHourChart } from "./attendance-hour-chart";
import { AttendanceWeekdayChart } from "./attendance-weekday-chart";
import { useAttendanceReport } from "./use-attendance-report";

export function AttendanceDetailsClient() {
  const {
    filters,
    setFilters,
    report,
    pending,
    applyFilters,
    resetFilters,
    exportActions,
  } = useAttendanceReport();

  return (
    <div className="space-y-6 print:space-y-4">
      <AttendanceFilters
        filters={filters}
        onChange={setFilters}
        onApply={applyFilters}
        onReset={resetFilters}
        onExportExcel={exportActions.exportExcel}
        onExportPdf={exportActions.exportPdf}
        onPrint={exportActions.printReport}
        pending={pending}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <AttendanceWeekdayChart data={report.weekdayStats} />
        <AttendanceHourChart data={report.hourStats} />
      </div>

      <AttendanceDetailTable rows={report.rows} />
    </div>
  );
}
