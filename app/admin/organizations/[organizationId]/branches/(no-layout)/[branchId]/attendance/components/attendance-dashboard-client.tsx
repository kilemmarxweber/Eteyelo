"use client";

import { AttendanceFilters } from "./attendance-filters";
import { AttendanceHourChart } from "./attendance-hour-chart";
import { AttendanceRecentList } from "./attendance-recent-list";
import { AttendanceStatCards } from "./attendance-stat-cards";
import { AttendanceWeekdayChart } from "./attendance-weekday-chart";
import { useAttendanceReport } from "./use-attendance-report";

export function AttendanceDashboardClient() {
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
      <AttendanceStatCards stats={report.stats} />
      <AttendanceRecentList items={report.recent} />

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
    </div>
  );
}
