"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Download,
  Eye,
  FilePlus2,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, normalizeImageSrc } from "@/lib/utils";
import { DocumentReadViewer } from "@/components/documents/document-read-viewer";
import { StaffBadgeSection } from "../../components/staff-badge-section";
import StudentAttendanceTable from "../../attendance/component/StudentAttendanceTable";
import TeacherScheduleTable, {
  type TeacherScheduleUI,
} from "./TeacherScheduleTable";
import { TeacherApplicationCompleteForm } from "./teacher-application-form";
import { replaceTeacherApplicationDocumentAction } from "./teacher-application.action";
import { uploadDocument } from "@/lib/upload-file";
import { toast } from "sonner";
import type {
  TeacherAttendanceStatus,
  TeacherProfileApplication,
  TeacherProfileData,
  TeacherProfileNote,
} from "./teacher-profile-types";

const FICHE_TYPE_LABEL: Record<string, string> = {
  ficheCote: "Fiche de cote",
  Devoir: "Devoir",
  Evaluation: "Évaluation",
  evaluations: "Évaluation",
  TP: "TP",
  TFC: "TFC",
  Memoire: "Mémoire",
};

function ficheTypeLabel(type: string) {
  return FICHE_TYPE_LABEL[type] ?? type;
}

function statusMeta(status: TeacherAttendanceStatus) {
  switch (status) {
    case "PRESENT":
      return { label: "Présent", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
    case "ABSENT":
      return { label: "Absent", className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" };
    case "LATE":
      return { label: "Retard", className: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300" };
    default:
      return { label: "Excusé", className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300" };
  }
}

function formatDate(iso: string, withTime = false) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function ScoreRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative mx-auto size-[8.5rem]">
      <div
        className="absolute inset-0 rounded-full shadow-inner"
        style={{
          background: `conic-gradient(var(--primary) ${pct * 3.6}deg, var(--muted) 0deg)`,
        }}
      />
      <div className="absolute inset-[11px] flex flex-col items-center justify-center rounded-full bg-card shadow-sm">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
          {pct}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          / 100
        </p>
      </div>
    </div>
  );
}

function ActionCard({
  href,
  onClick,
  icon,
  title,
  description,
  tone,
  delay,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: "sky" | "amber" | "violet" | "emerald";
  delay: string;
}) {
  const tones = {
    sky: "from-sky-500/[0.12] border-sky-500/20 hover:border-sky-500/40 hover:shadow-sky-500/10",
    amber:
      "from-amber-500/[0.12] border-amber-500/20 hover:border-amber-500/40 hover:shadow-amber-500/10",
    violet:
      "from-violet-500/[0.12] border-violet-500/20 hover:border-violet-500/40 hover:shadow-violet-500/10",
    emerald:
      "from-emerald-500/[0.12] border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-500/10",
  };

  const className = cn(
    "group animate-fade-up rounded-xl border bg-gradient-to-br via-card to-card p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
    tones[tone],
    delay,
  );

  const body = (
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background/80 text-primary shadow-sm transition-transform duration-300 group-hover:scale-105">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

export function TeacherProfileClient({
  profile,
  teaching,
  hours,
}: {
  profile: TeacherProfileData;
  teaching: TeacherScheduleUI[];
  hours: string[];
}) {
  const [tab, setTab] = React.useState("dossier");
  const [classId, setClassId] = React.useState(
    profile.classes[0]?.id ?? "all",
  );

  const initials =
    `${profile.nom?.[0] ?? ""}${profile.prenom?.[0] ?? ""}`.toUpperCase() ||
    "EN";

  const notesForClass: TeacherProfileNote[] =
    classId === "all"
      ? profile.notes
      : profile.notes.filter((note) => note.classId === classId);

  const notesByClassHref =
    classId === "all"
      ? profile.notesListHref
      : `${profile.notesListHref}&classId=${classId}`;

  const upcomingMeetings = profile.meetings.filter((m) => m.upcoming);
  const pastMeetings = profile.meetings.filter((m) => !m.upcoming);

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.14] via-sky-500/[0.07] to-card shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/25 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -bottom-16 left-10 size-40 rounded-full bg-amber-400/20 blur-3xl animate-pulse [animation-delay:700ms]" />

        <div className="relative flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              asChild
              variant="outline"
              size="icon"
              className="mt-0.5 size-9 shrink-0 border-primary/25 bg-background/70 text-primary hover:bg-primary/10 hover:text-primary"
            >
              <Link href={profile.listHref} aria-label="Retour à la liste">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>

            <div className="flex min-w-0 items-center gap-3.5">
              <div className="relative">
                <span className="absolute -inset-1 rounded-full bg-primary/30 blur-md animate-pulse" />
                <Avatar className="relative size-[4.75rem] border-2 border-background shadow-md">
                  {profile.image ? (
                    <AvatarImage
                      src={normalizeImageSrc(profile.image)}
                      alt={profile.fullName}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary/80">
                  <Sparkles className="size-3.5" />
                  Dossier {profile.teacherLabelLower}
                </p>
                <h1 className="truncate text-lg font-bold uppercase tracking-wide text-foreground md:text-xl">
                  {profile.fullName}
                </h1>
                <p className="mt-1 max-w-7xl text-xs leading-relaxed text-muted-foreground md:text-sm">
                  Former, inspirer et accompagner chaque classe avec exigence et
                  bienveillance.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={profile.statusActive ? "default" : "secondary"}
                    className={cn(
                      "rounded-full px-2 py-0 text-[11px]",
                      profile.statusActive &&
                        "border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {profile.statusLabel}
                  </Badge>
                  {profile.isTitulaire ? (
                    <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                      Titulaire
                    </span>
                  ) : null}
                  {profile.schoolYearLabel ? (
                    <span className="rounded-md border border-border/70 bg-background/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {profile.schoolYearLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 self-start lg:self-auto">
            <Button asChild variant="outline" className="gap-2">
              <Link href={profile.notesHref}>
                <FilePlus2 className="size-4" />
                Ajouter des notes
              </Link>
            </Button>
            <Button asChild className="gap-2 shadow-sm">
              <Link href={profile.devoirsHref}>
                <NotebookPen className="size-4" />
                Devoirs
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          href={profile.notesHref}
          icon={<FilePlus2 className="size-5" />}
          title="Ajouter des notes"
          description={`Saisir les cotes de ce ${profile.teacherLabelLower}.`}
          tone="sky"
          delay="animate-delay-75"
        />
        <ActionCard
          onClick={() => setTab("notes")}
          icon={<ClipboardList className="size-5" />}
          title="Notes par classe"
          description="Consulter les fiches déjà ajoutées."
          tone="amber"
          delay="animate-delay-150"
        />
        <ActionCard
          href={profile.devoirsHref}
          icon={<BookOpen className="size-5" />}
          title="Devoirs"
          description="Cours de l'enseignant déjà chargés."
          tone="violet"
          delay="animate-delay-225"
        />
        <ActionCard
          href={profile.calendarHref}
          icon={<CalendarDays className="size-5" />}
          title="Réunions"
          description="Agenda pédagogique et réunions."
          tone="emerald"
          delay="animate-delay-300"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <div className="min-w-0 space-y-4">
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="sticky top-0 z-10 grid h-auto w-full grid-cols-2 gap-1 rounded-lg border border-primary/20 bg-primary/10 p-1 sm:grid-cols-3 xl:grid-cols-5">
              <TabsTrigger
                value="dossier"
                className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <UserRound className="size-4" />
                Dossier
              </TabsTrigger>
              <TabsTrigger
                value="presences"
                className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Users className="size-4" />
                Présences
              </TabsTrigger>
              <TabsTrigger
                value="reunions"
                className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CalendarDays className="size-4" />
                Réunions
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <FileText className="size-4" />
                Notes
              </TabsTrigger>
              <TabsTrigger
                value="horaires"
                className="gap-1.5 rounded-md px-2 py-2 text-xs text-primary/80 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CalendarClock className="size-4" />
                Horaires
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dossier" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Cours", value: profile.stats.courseCount, hint: "Affectations actives" },
                  { label: "Classes", value: profile.stats.classCount, hint: "Groupes suivis" },
                  { label: "Notes", value: profile.stats.notesCount, hint: "Fiches saisies" },
                  { label: "Devoirs", value: profile.stats.assignmentsCount, hint: "Activités en ligne" },
                ].map((item, index) => (
                  <Card
                    key={item.label}
                    padding="sm"
                    className={cn(
                      "animate-fade-up rounded-xl border-primary/15 bg-gradient-to-b from-primary/[0.06] to-card",
                      index === 1 && "animate-delay-75",
                      index === 2 && "animate-delay-150",
                      index === 3 && "animate-delay-225",
                    )}
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-1.5 text-2xl font-bold tabular-nums">
                      {item.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{item.hint}</p>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden rounded-xl border-sky-200/80 bg-gradient-to-b from-sky-500/[0.07] via-card to-card p-0 shadow-sm dark:border-sky-900/40">
                  <div className="border-b border-sky-500/10 bg-sky-500/[0.06] px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                        <UserRound className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">Identité</h3>
                        <p className="text-xs text-muted-foreground">
                          Coordonnées du {profile.teacherLabelLower}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2.5 p-4">
                    <InfoRow icon={<Mail className="size-4" />} label="Email" value={profile.email} />
                    <InfoRow icon={<Phone className="size-4" />} label="Téléphone" value={profile.telephone} />
                    <InfoRow icon={<MapPin className="size-4" />} label="Adresse" value={profile.address} />
                    <div className="grid grid-cols-2 gap-2.5">
                      <MiniField label="Sexe" value={profile.sexe} />
                      <MiniField label="Naissance" value={profile.dateOfBirthLabel} />
                    </div>
                  </div>
                </Card>

                <Card className="overflow-hidden rounded-xl border-amber-200/80 bg-gradient-to-b from-amber-500/[0.08] via-card to-card p-0 shadow-sm dark:border-amber-900/40">
                  <div className="border-b border-amber-500/10 bg-amber-500/[0.07] px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <GraduationCap className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">Cours assignés</h3>
                        <p className="text-xs text-muted-foreground">
                          {profile.courses.length} affectation
                          {profile.courses.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[280px] space-y-2 overflow-auto p-4">
                    {profile.courses.length ? (
                      profile.courses.map((course) => (
                        <div
                          key={course.id}
                          className="rounded-lg border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-foreground">
                              {course.courseName}
                            </p>
                            {course.titulaire ? (
                              <Badge variant="warning" className="text-[10px]">
                                Titulaire
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {course.className}
                            {course.classCode ? ` · ${course.classCode}` : ""}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Aucun cours assigné pour l&apos;année en cours.
                      </p>
                    )}
                  </div>
                </Card>
              </div>

              {profile.application ? (
                <ApplicationDossierCard
                  application={profile.application}
                  teacherId={profile.teacherId}
                  canEditDocuments={profile.canEditApplicationDocuments}
                />
              ) : (
                <TeacherApplicationCompleteForm
                  teacherId={profile.teacherId}
                  branchType={profile.branchType}
                  teacherLabelLower={profile.teacherLabelLower}
                  needsBirthDate={profile.dateOfBirthLabel === "—"}
                  assignmentYearCount={profile.assignmentYearCount}
                  assignmentYearLabels={profile.assignmentYearLabels}
                />
              )}
            </TabsContent>

            <TabsContent value="presences" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Présents", value: profile.stats.present, tone: "text-emerald-700 dark:text-emerald-300" },
                  { label: "Absents", value: profile.stats.absent, tone: "text-rose-700 dark:text-rose-300" },
                  { label: "Retards", value: profile.stats.late, tone: "text-amber-800 dark:text-amber-300" },
                  { label: "Excusés", value: profile.stats.excused, tone: "text-sky-700 dark:text-sky-300" },
                ].map((item) => (
                  <Card key={item.label} padding="sm" className="rounded-xl">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className={cn("mt-1 text-2xl font-bold tabular-nums", item.tone)}>
                      {item.value}
                    </p>
                  </Card>
                ))}
              </div>

              {profile.currentSessions.length > 0 ? (
                <Card className="rounded-xl p-4">
                  <h3 className="mb-3 text-sm font-semibold">Séance en cours</h3>
                  <div className="space-y-4">
                    {profile.currentSessions.map((session) => {
                      const row = session as { id?: string };
                      return (
                        <StudentAttendanceTable
                          key={row.id ?? Math.random()}
                          session={session}
                        />
                      );
                    })}
                  </div>
                </Card>
              ) : null}

              <Card className="rounded-xl p-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold">Historique des présences</h3>
                    <p className="text-xs text-muted-foreground">
                      Pointages récents de ce {profile.teacherLabelLower}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={profile.attendanceHref}>Voir tout</Link>
                  </Button>
                </div>
                <div className="divide-y">
                  {profile.attendances.length ? (
                    profile.attendances.map((row) => {
                      const meta = statusMeta(row.status);
                      return (
                        <div
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {row.courseName}
                              {row.className ? ` · ${row.className}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(row.date)} · {formatTime(row.checkIn)} →{" "}
                              {formatTime(row.checkOut)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
                              meta.className,
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Aucune présence enregistrée pour le moment.
                    </p>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="reunions" className="space-y-4">
              <MeetingList
                title="À venir"
                empty="Aucune réunion à venir."
                items={upcomingMeetings}
              />
              <MeetingList
                title="Récentes"
                empty="Aucune réunion récente."
                items={pastMeetings}
              />
              <Button asChild variant="outline" className="w-full gap-2">
                <Link href={profile.calendarHref}>
                  <CalendarDays className="size-4" />
                  Ouvrir le calendrier scolaire
                </Link>
              </Button>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <Card className="rounded-xl p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Classe
                    </p>
                    <Select value={classId} onValueChange={setClassId}>
                      <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder="Choisir une classe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les classes</SelectItem>
                        {profile.classes.map((classe) => (
                          <SelectItem key={classe.id} value={classe.id}>
                            {classe.name}
                            {classe.code ? ` · ${classe.code}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="gap-2">
                      <Link href={notesByClassHref}>
                        <ClipboardList className="size-4" />
                        Voir la liste
                      </Link>
                    </Button>
                    <Button asChild className="gap-2">
                      <Link
                        href={
                          classId === "all"
                            ? profile.notesHref
                            : `${profile.notesHref}&classId=${classId}`
                        }
                      >
                        <FilePlus2 className="size-4" />
                        Ajouter des notes
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden rounded-xl p-0">
                <div className="border-b bg-muted/20 px-4 py-3">
                  <h3 className="text-sm font-semibold">
                    Notes ajoutées
                    {classId !== "all"
                      ? ` · ${profile.classes.find((c) => c.id === classId)?.name ?? ""}`
                      : ""}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {notesForClass.length} fiche
                    {notesForClass.length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="divide-y">
                  {notesForClass.length ? (
                    notesForClass.map((note) => (
                      <Link
                        key={note.id}
                        href={`${profile.baseHref}/fiches/${note.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {note.courseName} · {note.className}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ficheTypeLabel(note.typeFiche)} · {note.periodName}
                            {note.yearName ? ` · ${note.yearName}` : ""}
                          </p>
                        </div>
                        <Badge variant={note.status ? "success" : "warning"}>
                          {note.status ? "Validée" : "Ouverte"}
                        </Badge>
                      </Link>
                    ))
                  ) : (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Aucune note ajoutée pour cette classe.
                    </p>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="horaires">
              <Card className="rounded-xl p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4" />
                  Emploi du temps
                </h3>
                <TeacherScheduleTable
                  teaching={teaching}
                  hoursFromProps={hours}
                />
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <Card className="animate-fade-up overflow-hidden rounded-xl border-primary/20 bg-gradient-to-b from-primary/[0.08] via-card to-card p-4 shadow-sm">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">
              Performance
            </p>
            <div className="mt-3">
              <ScoreRing value={profile.stats.score} />
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Assiduité, ponctualité et activité pédagogique
            </p>
            <div className="mt-4 space-y-3">
              <PerfRow
                label="Taux de présence"
                value={profile.stats.presenceRate}
              />
              <PerfRow
                label="Ponctualité"
                value={
                  profile.stats.present + profile.stats.late > 0
                    ? Math.round(
                        (profile.stats.present /
                          (profile.stats.present + profile.stats.late)) *
                          100,
                      )
                    : 0
                }
              />
            </div>
          </Card>

          {profile.badge ? <StaffBadgeSection badge={profile.badge} /> : null}
        </aside>
      </div>
    </div>
  );
}

function ApplicationDossierCard({
  application,
  teacherId,
  canEditDocuments,
}: {
  application: TeacherProfileApplication;
  teacherId: string;
  canEditDocuments: boolean;
}) {
  const router = useRouter();
  const [viewer, setViewer] = React.useState<"cv" | "coverLetter" | null>(null);
  const [replacing, setReplacing] = React.useState(false);
  const [cvUrl, setCvUrl] = React.useState(application.cvUrl);
  const [coverLetterUrl, setCoverLetterUrl] = React.useState(
    application.coverLetterUrl,
  );

  React.useEffect(() => {
    setCvUrl(application.cvUrl);
    setCoverLetterUrl(application.coverLetterUrl);
  }, [application.cvUrl, application.coverLetterUrl]);

  const years = application.yearsOfExperience ?? 0;
  const yearHint = application.assignmentYearLabels.length
    ? application.assignmentYearLabels.join(", ")
    : "aucune affectation de classe pour le moment";
  const subjectsHint =
    application.subjectsSource === "assignment"
      ? "selon les cours actuellement affectés"
      : application.subjectsSource === "deposit"
        ? "selon le dépôt de candidature"
        : null;
  const levelsHint =
    application.levelsSource === "assignment"
      ? "selon les classes actuellement affectées"
      : application.levelsSource === "deposit"
        ? "selon le dépôt de candidature"
        : null;
  const availabilityHint =
    application.availability === "Actif"
      ? "engagé et affecté à l'année en cours"
      : application.availability === "Renvoyé"
        ? "compte inactif"
        : application.availability === "N'est plus actif"
          ? "sans affectation sur l'année en cours"
          : null;
  const facts = [
    {
      label: "Années d'expérience",
      value: `${years} an${years > 1 ? "s" : ""} · ${yearHint}`,
    },
    application.desiredSubjects
      ? {
          label: "Matières",
          value: application.desiredSubjects,
          hint: subjectsHint,
        }
      : null,
    application.desiredLevels
      ? {
          label: "Niveaux",
          value: application.desiredLevels,
          hint: levelsHint,
        }
      : null,
    application.availability
      ? {
          label: "Disponibilité",
          value: application.availability,
          hint: availabilityHint,
        }
      : null,
  ].filter(Boolean) as {
    label: string;
    value: string;
    hint?: string | null;
  }[];

  const texts = (
    [
      ["Expérience", application.experienceSummary],
      ["Formation", application.educationSummary],
      ["Compétences", application.skills],
      ["Motivation", application.motivation],
    ] as const
  ).filter(([, value]) => Boolean(value));

  const documents = [
    cvUrl ? { key: "cv" as const, label: "CV", href: cvUrl } : null,
    coverLetterUrl
      ? {
          key: "coverLetter" as const,
          label: "Lettre de motivation",
          href: coverLetterUrl,
        }
      : null,
  ].filter(Boolean) as {
    key: "cv" | "coverLetter";
    label: string;
    href: string;
  }[];

  const showDepositSubjects =
    application.subjectsSource === "assignment" &&
    Boolean(application.depositSubjects?.trim()) &&
    application.depositSubjects !== application.desiredSubjects;

  async function replaceDocument(
    document: "cv" | "coverLetter",
    file: File,
  ) {
    setReplacing(true);
    try {
      const uploaded = await uploadDocument(file);
      if (!uploaded.ok) {
        toast.error(uploaded.message);
        return;
      }
      const [, err] = await replaceTeacherApplicationDocumentAction({
        teacherId,
        document,
        url: uploaded.url,
      });
      if (err) {
        toast.error(err.message || "Remplacement impossible.");
        return;
      }
      if (document === "cv") setCvUrl(uploaded.url);
      else setCoverLetterUrl(uploaded.url);
      toast.success("Document remplacé.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Remplacement impossible.",
      );
    } finally {
      setReplacing(false);
    }
  }

  const activeDoc =
    viewer === "cv"
      ? { title: "CV", url: cvUrl, kind: "cv" as const }
      : viewer === "coverLetter"
        ? {
            title: "Lettre de motivation",
            url: coverLetterUrl,
            kind: "coverLetter" as const,
          }
        : null;

  return (
    <Card className="overflow-hidden rounded-xl border-violet-200/80 bg-gradient-to-b from-violet-500/[0.07] via-card to-card p-0 shadow-sm dark:border-violet-900/40">
      <div className="border-b border-violet-500/10 bg-violet-500/[0.06] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <Briefcase className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Dossier de candidature</h3>
              <p className="text-xs text-muted-foreground">
                {application.reference} · déposé le{" "}
                {formatDate(application.submittedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-4">
        {documents.length ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700/85 dark:text-violet-400">
              Documents · lecture seule
            </p>
            <div className="flex flex-wrap gap-2">
              {documents.map((doc) => (
                <div key={doc.href} className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setViewer(doc.key)}
                  >
                    <Eye className="mr-2 size-4" />
                    Lire {doc.label}
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <a
                      href={doc.href}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="mr-2 size-4" />
                      Télécharger
                    </a>
                  </Button>
                </div>
              ))}
            </div>
            {!canEditDocuments ? (
              <p className="text-xs text-muted-foreground">
                Consultation et téléchargement uniquement. Seul le propriétaire
                peut remplacer ces fichiers.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Vous êtes propriétaire : ouvrez un document pour le remplacer si
                besoin.
              </p>
            )}
          </div>
        ) : null}

        {facts.length ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {facts.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-violet-500/15 bg-violet-500/[0.06] px-3 py-2.5"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700/85 dark:text-violet-400">
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm font-medium">{item.value}</p>
                {item.hint ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.hint}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {showDepositSubjects ? (
          <div className="rounded-lg border border-dashed border-violet-500/20 bg-muted/20 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Matières au dépôt (conservées)
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {application.depositSubjects}
            </p>
          </div>
        ) : null}

        {application.parcours.length ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700/85 dark:text-violet-400">
              Parcours d&apos;affectation
            </p>
            <div className="space-y-2">
              {application.parcours.map((year) => (
                <div
                  key={year.yearId}
                  className="rounded-lg border border-violet-500/15 bg-violet-500/[0.06] px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{year.yearLabel}</p>
                    {year.isCurrent ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Année en cours
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {year.subjects.join(", ")}
                    {year.levels.length
                      ? ` · ${year.levels.join(", ")}`
                      : ""}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {year.items.map((item, index) => (
                      <li
                        key={`${year.yearId}-${item.courseName}-${item.className}-${index}`}
                        className="text-xs text-foreground/90"
                      >
                        {item.courseName}
                        {" · "}
                        {item.className}
                        {item.classCode ? ` (${item.classCode})` : ""}
                        {item.titulaire ? " · Titulaire" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {texts.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-violet-500/15 bg-violet-500/[0.06] px-3 py-2.5"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700/85 dark:text-violet-400">
              {label}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
              {value}
            </p>
          </div>
        ))}
      </div>

      {activeDoc?.url ? (
        <DocumentReadViewer
          open={Boolean(viewer)}
          onOpenChange={(open) => {
            if (!open) setViewer(null);
          }}
          title={activeDoc.title}
          fileUrl={activeDoc.url}
          canReplace={canEditDocuments}
          replacing={replacing}
          onReplaceFile={(file) => void replaceDocument(activeDoc.kind, file)}
        />
      ) : null}
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-sky-500/15 bg-sky-500/[0.06] px-3 py-2.5">
      <div className="mt-0.5 text-sky-600 dark:text-sky-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700/85 dark:text-sky-400">
          {label}
        </p>
        <p className="truncate text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-sky-500/15 bg-sky-500/[0.06] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700/85 dark:text-sky-400">
        {label}
      </p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function PerfRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}%</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function MeetingList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: TeacherProfileData["meetings"];
}) {
  return (
    <Card className="overflow-hidden rounded-xl p-0">
      <div className="border-b bg-muted/20 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="divide-y">
        {items.length ? (
          items.map((meeting) => (
            <div key={meeting.id} className="px-4 py-3">
              <p className="text-sm font-medium">{meeting.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(meeting.dateStart, true)}
                {meeting.location ? ` · ${meeting.location}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {meeting.typeName ? (
                  <Badge variant="outline">{meeting.typeName}</Badge>
                ) : null}
                {meeting.className ? (
                  <Badge variant="secondary">{meeting.className}</Badge>
                ) : null}
                {meeting.courseName ? (
                  <Badge variant="secondary">{meeting.courseName}</Badge>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        )}
      </div>
    </Card>
  );
}
