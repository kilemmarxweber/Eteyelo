"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { IconFileTypePdf, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDurationMinutes } from "@/lib/attendance-exit";
import {
  getAttendanceDailyJournalAction,
  getAttendanceReportContextAction,
  getPersonnelRosterReportAction,
  getStudentRosterReportAction,
  getTeacherSessionReportAction,
  type AttendanceDailyJournal,
  type PersonRosterReport,
  type TeacherSessionReport,
} from "../attendance-exit.action";
import {
  exportAttendanceDailyJournalPdf,
  exportPersonRosterReportPdf,
  exportTeacherSessionReportPdf,
} from "../component/export-attendance-journal-pdf";
import { buildAttendancePdfLabels } from "../attendance-pdf-labels";
import { intlLocaleFromUserLocale, normalizeUserLocale } from "@/lib/user-locale";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

export function AttendanceReportsClient({
  teachers,
  classes,
}: {
  teachers: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const locale = intlLocaleFromUserLocale(normalizeUserLocale(useLocale()));
  const pdfLabels = useMemo(() => buildAttendancePdfLabels(t), [t]);
  const dash = t("dash");
  const [day, setDay] = useState(todayIso);
  const [startDate, setStartDate] = useState(firstDayOfMonthIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [teacherId, setTeacherId] = useState<string>("all");
  const [classeId, setClasseId] = useState<string>("all");
  const [studentClasseId, setStudentClasseId] = useState<string>("all");
  const [rosterStart, setRosterStart] = useState(todayIso);
  const [rosterEnd, setRosterEnd] = useState(todayIso);

  const [journal, setJournal] = useState<AttendanceDailyJournal | null>(null);
  const [sessions, setSessions] = useState<TeacherSessionReport | null>(null);
  const [studentRoster, setStudentRoster] =
    useState<PersonRosterReport | null>(null);
  const [personnelRoster, setPersonnelRoster] =
    useState<PersonRosterReport | null>(null);
  const [loadingJournal, setLoadingJournal] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingPersonnel, setLoadingPersonnel] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadJournal = async () => {
    setLoadingJournal(true);
    const [data, error] = await getAttendanceDailyJournalAction({
      date: new Date(day),
    });
    if (error || !data) {
      toast.error(error?.message || t("reports.loadJournalFailed"));
      setJournal(null);
    } else {
      setJournal(data);
    }
    setLoadingJournal(false);
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    const [data, error] = await getTeacherSessionReportAction({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      teacherId: teacherId === "all" ? null : teacherId,
      classeId: classeId === "all" ? null : classeId,
    });
    if (error || !data) {
      toast.error(error?.message || t("reports.loadSessionsFailed"));
      setSessions(null);
    } else {
      setSessions(data);
    }
    setLoadingSessions(false);
  };

  const loadStudentRoster = async () => {
    setLoadingStudents(true);
    const [data, error] = await getStudentRosterReportAction({
      startDate: new Date(rosterStart),
      endDate: new Date(rosterEnd),
      classeId: studentClasseId === "all" ? null : studentClasseId,
    });
    if (error || !data) {
      toast.error(error?.message || t("reports.loadStudentsFailed"));
      setStudentRoster(null);
    } else {
      setStudentRoster(data);
    }
    setLoadingStudents(false);
  };

  const loadPersonnelRoster = async () => {
    setLoadingPersonnel(true);
    const [data, error] = await getPersonnelRosterReportAction({
      startDate: new Date(rosterStart),
      endDate: new Date(rosterEnd),
    });
    if (error || !data) {
      toast.error(
        error?.message || t("reports.loadPersonnelFailed"),
      );
      setPersonnelRoster(null);
    } else {
      setPersonnelRoster(data);
    }
    setLoadingPersonnel(false);
  };

  useEffect(() => {
    void loadJournal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => {
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, teacherId, classeId]);

  useEffect(() => {
    void loadStudentRoster();
    void loadPersonnelRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterStart, rosterEnd, studentClasseId]);

  const personTypeLabel = useMemo(
    () =>
      ({
        student: t("personType.student"),
        teacher: t("personType.teacher"),
        personnel: t("personType.personnel"),
      }) as const,
    [t],
  );

  async function exportJournal() {
    if (!journal) return;
    setExporting(true);
    try {
      const [context, error] = await getAttendanceReportContextAction();
      if (error || !context) throw new Error(error?.message || t("reports.pdfContextFailed"));
      await exportAttendanceDailyJournalPdf(journal, context, pdfLabels);
      toast.success(t("reports.journalPdfSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("reports.pdfError"));
    } finally {
      setExporting(false);
    }
  }

  async function exportSessions() {
    if (!sessions) return;
    setExporting(true);
    try {
      const [context, error] = await getAttendanceReportContextAction();
      if (error || !context) throw new Error(error?.message || t("reports.pdfContextFailed"));
      await exportTeacherSessionReportPdf(sessions, context, pdfLabels);
      toast.success(t("reports.sessionsPdfSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("reports.pdfError"));
    } finally {
      setExporting(false);
    }
  }

  async function exportStudentRoster() {
    if (!studentRoster) return;
    setExporting(true);
    try {
      const [context, error] = await getAttendanceReportContextAction();
      if (error || !context) throw new Error(error?.message || t("reports.pdfContextFailed"));
      await exportPersonRosterReportPdf(studentRoster, context, pdfLabels, {
        title: t("pdf.studentRosterTitle"),
        filePrefix: "rapport-presence-eleves",
      });
      toast.success(t("reports.studentsPdfSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("reports.pdfError"));
    } finally {
      setExporting(false);
    }
  }

  async function exportPersonnelRoster() {
    if (!personnelRoster) return;
    setExporting(true);
    try {
      const [context, error] = await getAttendanceReportContextAction();
      if (error || !context) throw new Error(error?.message || t("reports.pdfContextFailed"));
      await exportPersonRosterReportPdf(personnelRoster, context, pdfLabels, {
        title: t("pdf.personnelRosterTitle"),
        filePrefix: "rapport-presence-personnel",
      });
      toast.success(t("reports.personnelPdfSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("reports.pdfError"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">{t("reports.pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("reports.pageDescription")}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>{t("reports.dailyTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("reports.dailyDescription")}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("filters.date")}</Label>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadJournal()}
              disabled={loadingJournal}
            >
              <IconRefresh className="mr-1 size-4" />
              {t("filters.refresh")}
            </Button>
            <Button
              size="sm"
              onClick={() => void exportJournal()}
              disabled={!journal || exporting}
            >
              <IconFileTypePdf className="mr-1 size-4" />
              {t("reports.dailyPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingJournal ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : journal ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label={t("reports.teacherSessions")}
                  value={String(journal.stats.teacherSessions)}
                />
                <Stat
                  label={t("reports.hoursWorked")}
                  value={formatDurationMinutes(journal.stats.teacherMinutes)}
                />
                <Stat
                  label={t("reports.studentExits")}
                  value={String(journal.stats.studentEarlyExits)}
                />
                <Stat
                  label={t("reports.staffExits")}
                  value={`${journal.stats.teacherEarlyExits} / ${journal.stats.personnelEarlyExits}`}
                />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2">{t("reports.columns.session")}</th>
                      <th className="px-3 py-2">{t("reports.columns.teacher")}</th>
                      <th className="px-3 py-2">{t("reports.columns.subject")}</th>
                      <th className="px-3 py-2">{t("reports.columns.class")}</th>
                      <th className="px-3 py-2">{t("reports.columns.start")}</th>
                      <th className="px-3 py-2">{t("reports.columns.end")}</th>
                      <th className="px-3 py-2">{t("reports.columns.duration")}</th>
                      <th className="px-3 py-2">{t("reports.columns.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.teacherSessions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-4 text-center text-muted-foreground"
                        >
                          {t("reports.noTeacherSessionToday")}
                        </td>
                      </tr>
                    ) : (
                      journal.teacherSessions.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="px-3 py-2">{row.sessionLabel}</td>
                          <td className="px-3 py-2">{row.teacherName}</td>
                          <td className="px-3 py-2">{row.subject}</td>
                          <td className="px-3 py-2">{row.classeName}</td>
                          <td className="px-3 py-2">
                            {row.actualStart ?? row.plannedStart}
                          </td>
                          <td className="px-3 py-2">
                            {row.actualEnd ?? row.plannedEnd}
                          </td>
                          <td className="px-3 py-2">{row.minutesLabel}</td>
                          <td className="px-3 py-2">
                            {row.earlyExit
                              ? row.exitReason || t("reports.earlyExitLabel")
                              : row.statusLabel}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  {t("reports.earlyExitsTitle")}
                </h3>
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-amber-50 text-left dark:bg-amber-950/30">
                      <tr>
                        <th className="px-3 py-2">{t("reports.columns.type")}</th>
                        <th className="px-3 py-2">{t("reports.columns.name")}</th>
                        <th className="px-3 py-2">{t("reports.columns.context")}</th>
                        <th className="px-3 py-2">{t("reports.columns.arrival")}</th>
                        <th className="px-3 py-2">{t("reports.columns.departure")}</th>
                        <th className="px-3 py-2">{t("reports.columns.reason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journal.earlyExits.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-4 text-center text-muted-foreground"
                          >
                            {t("reports.noEarlyExit")}
                          </td>
                        </tr>
                      ) : (
                        journal.earlyExits.map((row) => (
                          <tr key={row.id} className="border-t">
                            <td className="px-3 py-2">
                              {personTypeLabel[row.personType]}
                            </td>
                            <td className="px-3 py-2">{row.personName}</td>
                            <td className="px-3 py-2">
                              {row.contextLabel || dash}
                            </td>
                            <td className="px-3 py-2">{row.checkIn || dash}</td>
                            <td className="px-3 py-2">{row.checkOut || dash}</td>
                            <td className="px-3 py-2">{row.exitReason}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("reports.noData")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>{t("reports.sessionsTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("reports.sessionsDescription")}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("filters.dateFrom")}</Label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("filters.dateTo")}</Label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("filters.teacher")}</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("filters.allTeachers")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allTeachers")}</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("filters.class")}</Label>
              <Select value={classeId} onValueChange={setClasseId}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t("filters.allClasses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allClasses")}</SelectItem>
                  {classes.map((classe) => (
                    <SelectItem key={classe.id} value={classe.id}>
                      {classe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadSessions()}
              disabled={loadingSessions}
            >
              <IconRefresh className="mr-1 size-4" />
              {t("filters.refresh")}
            </Button>
            <Button
              size="sm"
              onClick={() => void exportSessions()}
              disabled={!sessions || exporting}
            >
              <IconFileTypePdf className="mr-1 size-4" />
              {t("reports.sessionsPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : sessions ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("reports.sessionsSummary", {
                  sessions: sessions.summary.sessions,
                  duration: formatDurationMinutes(sessions.summary.minutesTotal),
                  earlyExits: sessions.summary.earlyExits,
                })}
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2">{t("reports.columns.date")}</th>
                      <th className="px-3 py-2">{t("reports.columns.session")}</th>
                      <th className="px-3 py-2">{t("reports.columns.teacher")}</th>
                      <th className="px-3 py-2">{t("reports.columns.subject")}</th>
                      <th className="px-3 py-2">{t("reports.columns.class")}</th>
                      <th className="px-3 py-2">{t("reports.columns.start")}</th>
                      <th className="px-3 py-2">{t("reports.columns.end")}</th>
                      <th className="px-3 py-2">{t("reports.columns.duration")}</th>
                      <th className="px-3 py-2">{t("reports.columns.reason")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-3 py-4 text-center text-muted-foreground"
                        >
                          {t("reports.noSessionPeriod")}
                        </td>
                      </tr>
                    ) : (
                      sessions.rows.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="px-3 py-2">
                            {new Date(row.date).toLocaleDateString(locale)}
                          </td>
                          <td className="px-3 py-2">{row.sessionLabel}</td>
                          <td className="px-3 py-2">{row.teacherName}</td>
                          <td className="px-3 py-2">{row.subject}</td>
                          <td className="px-3 py-2">{row.classeName}</td>
                          <td className="px-3 py-2">
                            {row.actualStart ?? row.plannedStart}
                          </td>
                          <td className="px-3 py-2">
                            {row.actualEnd ?? row.plannedEnd}
                          </td>
                          <td className="px-3 py-2">{row.minutesLabel}</td>
                          <td className="px-3 py-2">
                            {row.earlyExit ? row.exitReason || dash : dash}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("reports.noData")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>{t("reports.studentsTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("reports.studentsDescription")}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("filters.dateFrom")}</Label>
              <input
                type="date"
                value={rosterStart}
                onChange={(e) => setRosterStart(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("filters.dateTo")}</Label>
              <input
                type="date"
                value={rosterEnd}
                onChange={(e) => setRosterEnd(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("filters.class")}</Label>
              <Select
                value={studentClasseId}
                onValueChange={setStudentClasseId}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t("filters.allClasses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allClasses")}</SelectItem>
                  {classes.map((classe) => (
                    <SelectItem key={classe.id} value={classe.id}>
                      {classe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadStudentRoster()}
              disabled={loadingStudents}
            >
              <IconRefresh className="mr-1 size-4" />
              {t("filters.refresh")}
            </Button>
            <Button
              size="sm"
              onClick={() => void exportStudentRoster()}
              disabled={!studentRoster || exporting}
            >
              <IconFileTypePdf className="mr-1 size-4" />
              {t("reports.studentsPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <RosterTable
            loading={loadingStudents}
            report={studentRoster}
            emptyLabel={t("reports.noStudentPeriod")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>{t("reports.personnelTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("reports.personnelDescription")}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadPersonnelRoster()}
              disabled={loadingPersonnel}
            >
              <IconRefresh className="mr-1 size-4" />
              {t("filters.refresh")}
            </Button>
            <Button
              size="sm"
              onClick={() => void exportPersonnelRoster()}
              disabled={!personnelRoster || exporting}
            >
              <IconFileTypePdf className="mr-1 size-4" />
              {t("reports.personnelPdf")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("reports.samePeriodHint", {
              start: rosterStart,
              end: rosterEnd,
            })}
          </p>
          <RosterTable
            loading={loadingPersonnel}
            report={personnelRoster}
            emptyLabel={t("reports.noPersonnelPeriod")}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function RosterTable({
  loading,
  report,
  emptyLabel,
}: {
  loading: boolean;
  report: PersonRosterReport | null;
  emptyLabel: string;
}) {
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const locale = intlLocaleFromUserLocale(normalizeUserLocale(useLocale()));
  const dash = t("dash");

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
    );
  }
  if (!report) {
    return (
      <p className="text-sm text-muted-foreground">{t("reports.noData")}</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label={t("stats.total")} value={String(report.summary.total)} />
        <Stat label={t("stats.present")} value={String(report.summary.present)} />
        <Stat label={t("stats.late")} value={String(report.summary.late)} />
        <Stat label={t("stats.excused")} value={String(report.summary.excused)} />
        <Stat label={t("stats.absent")} value={String(report.summary.absent)} />
      </div>
      {report.summary.earlyExits > 0 ? (
        <p className="text-sm text-amber-700">
          {t("reports.earlyExitsCount", { count: report.summary.earlyExits })}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">{t("reports.columns.date")}</th>
              <th className="px-3 py-2">{t("reports.columns.name")}</th>
              <th className="px-3 py-2">{t("reports.columns.context")}</th>
              <th className="px-3 py-2">{t("reports.columns.status")}</th>
              <th className="px-3 py-2">{t("reports.columns.arrival")}</th>
              <th className="px-3 py-2">{t("reports.columns.departure")}</th>
              <th className="px-3 py-2">{t("reports.columns.exitReason")}</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-muted-foreground"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              report.rows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.status === "ABSENT"
                      ? "border-t bg-red-50/60 dark:bg-red-950/20"
                      : row.earlyExit
                        ? "border-t bg-amber-50/60 dark:bg-amber-950/20"
                        : "border-t"
                  }
                >
                  <td className="px-3 py-2">
                    {new Date(row.date).toLocaleDateString(locale)}
                  </td>
                  <td className="px-3 py-2 font-medium">{row.personName}</td>
                  <td className="px-3 py-2">{row.contextLabel}</td>
                  <td className="px-3 py-2">{row.statusLabel}</td>
                  <td className="px-3 py-2">{row.checkIn || dash}</td>
                  <td className="px-3 py-2">{row.checkOut || dash}</td>
                  <td className="px-3 py-2">
                    {row.earlyExit ? row.exitReason || dash : dash}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
