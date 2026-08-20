"use client";

import { useEffect, useMemo, useState } from "react";
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
      toast.error(error?.message || "Impossible de charger le journal.");
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
      toast.error(error?.message || "Impossible de charger les séances.");
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
      toast.error(error?.message || "Impossible de charger le rapport élèves.");
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
        error?.message || "Impossible de charger le rapport personnel.",
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
        student: "Élève",
        teacher: "Enseignant",
        personnel: "Personnel",
      }) as const,
    [],
  );

  async function exportJournal() {
    if (!journal) return;
    setExporting(true);
    try {
      const [context, error] = await getAttendanceReportContextAction();
      if (error || !context) throw new Error(error?.message || "Contexte PDF");
      await exportAttendanceDailyJournalPdf(journal, context);
      toast.success("Rapport journalier PDF généré.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur PDF");
    } finally {
      setExporting(false);
    }
  }

  async function exportSessions() {
    if (!sessions) return;
    setExporting(true);
    try {
      const [context, error] = await getAttendanceReportContextAction();
      if (error || !context) throw new Error(error?.message || "Contexte PDF");
      await exportTeacherSessionReportPdf(sessions, context);
      toast.success("Rapport séances enseignants PDF généré.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur PDF");
    } finally {
      setExporting(false);
    }
  }

  async function exportStudentRoster() {
    if (!studentRoster) return;
    setExporting(true);
    try {
      const [context, error] = await getAttendanceReportContextAction();
      if (error || !context) throw new Error(error?.message || "Contexte PDF");
      await exportPersonRosterReportPdf(studentRoster, context, {
        title: "Rapport de présence élèves",
        filePrefix: "rapport-presence-eleves",
      });
      toast.success("Rapport élèves PDF généré.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur PDF");
    } finally {
      setExporting(false);
    }
  }

  async function exportPersonnelRoster() {
    if (!personnelRoster) return;
    setExporting(true);
    try {
      const [context, error] = await getAttendanceReportContextAction();
      if (error || !context) throw new Error(error?.message || "Contexte PDF");
      await exportPersonRosterReportPdf(personnelRoster, context, {
        title: "Rapport de présence personnel",
        filePrefix: "rapport-presence-personnel",
      });
      toast.success("Rapport personnel PDF généré.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Rapports de présence</h1>
        <p className="text-sm text-muted-foreground">
          Journal du jour, séances enseignants, et effectifs complets élèves /
          personnel (arrivée, sortie, absents, motifs de sortie anticipée).
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Rapport journalier</CardTitle>
            <p className="text-sm text-muted-foreground">
              Séances du jour, heures début/fin, sorties anticipées avec motif.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
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
              Actualiser
            </Button>
            <Button
              size="sm"
              onClick={() => void exportJournal()}
              disabled={!journal || exporting}
            >
              <IconFileTypePdf className="mr-1 size-4" />
              PDF journalier
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingJournal ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : journal ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Séances enseignants"
                  value={String(journal.stats.teacherSessions)}
                />
                <Stat
                  label="Heures effectuées"
                  value={formatDurationMinutes(journal.stats.teacherMinutes)}
                />
                <Stat
                  label="Sorties élèves"
                  value={String(journal.stats.studentEarlyExits)}
                />
                <Stat
                  label="Sorties ens. / pers."
                  value={`${journal.stats.teacherEarlyExits} / ${journal.stats.personnelEarlyExits}`}
                />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2">Séance</th>
                      <th className="px-3 py-2">Enseignant</th>
                      <th className="px-3 py-2">Matière</th>
                      <th className="px-3 py-2">Classe</th>
                      <th className="px-3 py-2">Début</th>
                      <th className="px-3 py-2">Fin</th>
                      <th className="px-3 py-2">Durée</th>
                      <th className="px-3 py-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.teacherSessions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-4 text-center text-muted-foreground"
                        >
                          Aucune séance enseignant ce jour.
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
                              ? row.exitReason || "Sortie anticipée"
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
                  Sorties anticipées du jour
                </h3>
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-amber-50 text-left dark:bg-amber-950/30">
                      <tr>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Nom</th>
                        <th className="px-3 py-2">Contexte</th>
                        <th className="px-3 py-2">Arrivée</th>
                        <th className="px-3 py-2">Sortie</th>
                        <th className="px-3 py-2">Motif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journal.earlyExits.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-4 text-center text-muted-foreground"
                          >
                            Aucune sortie anticipée.
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
                              {row.contextLabel || "—"}
                            </td>
                            <td className="px-3 py-2">{row.checkIn || "—"}</td>
                            <td className="px-3 py-2">{row.checkOut || "—"}</td>
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
            <p className="text-sm text-muted-foreground">Aucune donnée.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Rapport séances enseignants (période)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Nom, matière, classe, 1ère séance…, heures début/fin et durée
              effectuée. Filtrable par enseignant ou classe.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Du</Label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Au</Label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Enseignant</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Classe</Label>
              <Select value={classeId} onValueChange={setClasseId}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
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
              Actualiser
            </Button>
            <Button
              size="sm"
              onClick={() => void exportSessions()}
              disabled={!sessions || exporting}
            >
              <IconFileTypePdf className="mr-1 size-4" />
              PDF séances
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : sessions ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {sessions.summary.sessions} séance(s) ·{" "}
                {formatDurationMinutes(sessions.summary.minutesTotal)} ·{" "}
                {sessions.summary.earlyExits} sortie(s) anticipée(s)
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Séance</th>
                      <th className="px-3 py-2">Enseignant</th>
                      <th className="px-3 py-2">Matière</th>
                      <th className="px-3 py-2">Classe</th>
                      <th className="px-3 py-2">Début</th>
                      <th className="px-3 py-2">Fin</th>
                      <th className="px-3 py-2">Durée</th>
                      <th className="px-3 py-2">Motif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-3 py-4 text-center text-muted-foreground"
                        >
                          Aucune séance pour cette période / filtre.
                        </td>
                      </tr>
                    ) : (
                      sessions.rows.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="px-3 py-2">
                            {new Date(row.date).toLocaleDateString("fr-FR")}
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
                            {row.earlyExit ? row.exitReason || "—" : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune donnée.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Rapport élèves (effectifs complets)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tous les élèves : arrivée, sortie, absents, sorties anticipées avec
              motif. Filtrable par classe et période.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Du</Label>
              <input
                type="date"
                value={rosterStart}
                onChange={(e) => setRosterStart(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Au</Label>
              <input
                type="date"
                value={rosterEnd}
                onChange={(e) => setRosterEnd(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Classe</Label>
              <Select
                value={studentClasseId}
                onValueChange={setStudentClasseId}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
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
              Actualiser
            </Button>
            <Button
              size="sm"
              onClick={() => void exportStudentRoster()}
              disabled={!studentRoster || exporting}
            >
              <IconFileTypePdf className="mr-1 size-4" />
              PDF élèves
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <RosterTable
            loading={loadingStudents}
            report={studentRoster}
            emptyLabel="Aucun élève inscrit pour cette période / classe."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Rapport personnel (effectifs complets)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tout le personnel : arrivée, sortie, absents, sorties anticipées
              avec motif.
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
              Actualiser
            </Button>
            <Button
              size="sm"
              onClick={() => void exportPersonnelRoster()}
              disabled={!personnelRoster || exporting}
            >
              <IconFileTypePdf className="mr-1 size-4" />
              PDF personnel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Même période que le rapport élèves ({rosterStart} → {rosterEnd}).
          </p>
          <RosterTable
            loading={loadingPersonnel}
            report={personnelRoster}
            emptyLabel="Aucun personnel pour cette période."
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
  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }
  if (!report) {
    return <p className="text-sm text-muted-foreground">Aucune donnée.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total" value={String(report.summary.total)} />
        <Stat label="Présents" value={String(report.summary.present)} />
        <Stat label="Retards" value={String(report.summary.late)} />
        <Stat label="Excusés" value={String(report.summary.excused)} />
        <Stat label="Absents" value={String(report.summary.absent)} />
      </div>
      {report.summary.earlyExits > 0 ? (
        <p className="text-sm text-amber-700">
          {report.summary.earlyExits} sortie(s) anticipée(s) avec motif.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Contexte</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Arrivée</th>
              <th className="px-3 py-2">Sortie</th>
              <th className="px-3 py-2">Motif sortie</th>
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
                    {new Date(row.date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-2 font-medium">{row.personName}</td>
                  <td className="px-3 py-2">{row.contextLabel}</td>
                  <td className="px-3 py-2">{row.statusLabel}</td>
                  <td className="px-3 py-2">{row.checkIn || "—"}</td>
                  <td className="px-3 py-2">{row.checkOut || "—"}</td>
                  <td className="px-3 py-2">
                    {row.earlyExit ? row.exitReason || "—" : "—"}
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
