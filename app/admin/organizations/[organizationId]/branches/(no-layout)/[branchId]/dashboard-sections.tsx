"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import {
  IconUsers,
  IconSchool,
  IconBook,
  IconCurrencyDollar,
  IconChartBar,
  IconCalendar,
  IconChalkboardTeacher,
  IconClipboardList,
  IconLibrary,
} from "@tabler/icons-react";
import Link from "next/link";
import { formatReportAmountCurrencyFirst } from "@/lib/reports/format-amount";
import { cn } from "@/lib/utils";
import type { DashboardShortcut } from "./dashboard-shortcuts";

function formatSignedPercent(value: number | undefined | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "0%";
  return n > 0 ? `+${n}%` : `${n}%`;
}

function rateTone(value: number) {
  if (value >= 75) return "bg-emerald-600";
  if (value >= 50) return "bg-blue-600";
  if (value >= 25) return "bg-amber-500";
  return "bg-rose-500";
}

const SHORTCUT_ICONS = {
  users: IconUsers,
  school: IconSchool,
  book: IconBook,
  currency: IconCurrencyDollar,
  calendar: IconCalendar,
  chart: IconChartBar,
  attendance: IconClipboardList,
  notes: IconBook,
  library: IconLibrary,
  results: IconChartBar,
} as const;

type SchoolStatsProps = {
  loading: boolean;
  studentLabel: string;
  teacherLabel: string;
  classLabelPlural: string;
  studentTotal: number;
  teacherTotal: number;
  classTotal: number;
  enrollmentRate: number;
  teacherActivityRate: number;
  classOccupancyRate: number;
  studentChange?: number;
  teacherChange?: number;
  classChange?: number;
  showRevenue: boolean;
  revenueCurrent?: number;
  revenueCurrency?: string;
  revenueChange?: number;
  selectedRatePair?: string | null;
  baseCurrency?: string | null;
};

export function SchoolStatsSection({
  loading,
  studentLabel,
  teacherLabel,
  classLabelPlural,
  studentTotal,
  teacherTotal,
  classTotal,
  enrollmentRate,
  teacherActivityRate,
  classOccupancyRate,
  studentChange,
  teacherChange,
  classChange,
  showRevenue,
  revenueCurrent,
  revenueCurrency,
  revenueChange,
  selectedRatePair,
  baseCurrency,
}: SchoolStatsProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        showRevenue ? "xl:grid-cols-4" : "xl:grid-cols-3",
      )}
    >
      <BranchStatCard
        label={studentLabel}
        value={loading ? "—" : studentTotal}
        description={`${enrollmentRate}% inscrits · ${formatSignedPercent(studentChange)} vs mois dernier`}
        icon={IconUsers}
      />
      <BranchStatCard
        label={teacherLabel}
        value={loading ? "—" : teacherTotal}
        description={`${teacherActivityRate}% actifs · ${formatSignedPercent(teacherChange)} vs mois dernier`}
        icon={IconChalkboardTeacher}
      />
      <BranchStatCard
        label={classLabelPlural}
        value={loading ? "—" : classTotal}
        description={`${classOccupancyRate}% occupés · ${formatSignedPercent(classChange)} vs mois dernier`}
        icon={IconSchool}
      />
      {showRevenue ? (
        <BranchStatCard
          label={`Revenus (${revenueCurrency ?? baseCurrency ?? "…"})`}
          value={
            loading
              ? "—"
              : formatReportAmountCurrencyFirst(
                  Number(revenueCurrent ?? 0),
                  revenueCurrency ?? baseCurrency ?? "USD",
                )
          }
          description={
            selectedRatePair
              ? `Base ${selectedRatePair} · ${formatSignedPercent(revenueChange)} vs mois dernier`
              : `${formatSignedPercent(revenueChange)} vs mois dernier`
          }
          icon={IconCurrencyDollar}
        />
      ) : null}
    </div>
  );
}

export function ShortcutsSection({
  actions,
}: {
  actions: DashboardShortcut[];
}) {
  if (actions.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-2",
        actions.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {actions.map((action) => {
        const Icon = SHORTCUT_ICONS[action.iconKey] ?? IconBook;
        return (
          <Link key={`${action.href}-${action.title}`} href={action.href}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <div className={`rounded-lg p-2 text-white ${action.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="ml-3 text-sm font-medium">
                  {action.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {action.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export function EventsSection({
  branchTypeLabel,
  events,
}: {
  branchTypeLabel: string;
  events: { id: string; title?: string | null; dateStart: string | Date }[];
}) {
  const upcomingEvents = events
    .filter((event) => new Date(event.dateStart).getTime() >= Date.now())
    .sort(
      (a, b) =>
        new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime(),
    )
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCalendar className="h-5 w-5" />
          Prochains événements
        </CardTitle>
        <CardDescription>
          Événements à venir dans votre {branchTypeLabel.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => {
              const eventDate = new Date(event.dateStart);
              const diffDays = Math.ceil(
                (eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );

              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {eventDate.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {diffDays === 0
                      ? "Aujourd'hui"
                      : `Dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`}
                  </Badge>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun événement à venir
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type MetricsProps = {
  branchTypeLabel: string;
  showParents: boolean;
  metrics: {
    attendance: number;
    attendanceCount: number;
    successRate: number;
    averageScore: number;
    studentsCount: number;
    passedCount: number;
    satisfaction: number;
    feedbackCount: number;
    parentsCount: number;
    responseRate: number;
  };
  studentsLabelLower: string;
};

export function PedagogyMetricsSection({
  branchTypeLabel,
  showParents,
  metrics,
  studentsLabelLower,
}: MetricsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconChartBar className="h-5 w-5" />
          Métriques de performance
        </CardTitle>
        <CardDescription>Indicateurs clés — {branchTypeLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Taux de présence</span>
              <span className="text-sm text-muted-foreground">
                {metrics.attendanceCount > 0 ? `${metrics.attendance}%` : "—"}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  rateTone(metrics.attendance),
                )}
                style={{
                  width: `${Math.min(100, Math.max(0, metrics.attendance))}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {metrics.attendanceCount > 0
                ? `${metrics.attendanceCount} pointages (présent + retard)`
                : "Aucune présence enregistrée pour le moment"}
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Moyenne générale</span>
              <span className="text-sm text-muted-foreground">
                {metrics.studentsCount > 0 ? `${metrics.averageScore}%` : "—"}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  rateTone(metrics.averageScore),
                )}
                style={{
                  width: `${Math.min(100, Math.max(0, metrics.averageScore))}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {metrics.studentsCount > 0
                ? `Réussite ${metrics.successRate}% · ${metrics.passedCount}/${metrics.studentsCount} ${studentsLabelLower} ≥ 50%`
                : "Aucune cote enregistrée pour le moment"}
            </p>
          </div>

          {showParents ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Satisfaction parents</span>
                <span className="text-sm text-muted-foreground">
                  {metrics.feedbackCount > 0
                    ? `${metrics.satisfaction}%`
                    : "—"}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    rateTone(metrics.satisfaction),
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(0, metrics.satisfaction))}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {metrics.feedbackCount > 0
                  ? `${metrics.feedbackCount} avis · réponse du mois ${metrics.responseRate}% (${metrics.parentsCount} parents)`
                  : "Aucun avis parent ce mois — popup à la 1ʳᵉ connexion"}
              </p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function CashierStatsSection({
  loading,
  todayIncome,
  todayCount,
  unpaidInvoices,
  currency,
}: {
  loading: boolean;
  todayIncome: number;
  todayCount: number;
  unpaidInvoices: number;
  currency: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <BranchStatCard
        label="Encaissements du jour"
        value={
          loading
            ? "—"
            : formatReportAmountCurrencyFirst(todayIncome, currency)
        }
        description={
          loading
            ? "…"
            : `${todayCount} paiement${todayCount > 1 ? "s" : ""} validé${todayCount > 1 ? "s" : ""}`
        }
        icon={IconCurrencyDollar}
      />
      <BranchStatCard
        label="Impayés"
        value={loading ? "—" : unpaidInvoices}
        description="Factures non soldées (année en cours)"
        icon={IconClipboardList}
      />
      <BranchStatCard
        label="Paiements aujourd'hui"
        value={loading ? "—" : todayCount}
        description="File d'attente / encaissements"
        icon={IconUsers}
      />
    </div>
  );
}

export function TeacherSpaceSection({
  loading,
  classes,
  todayCourses,
  assignmentCount,
}: {
  loading: boolean;
  classes: { id: string; name: string }[];
  todayCourses: {
    id: string;
    courseName: string;
    className: string;
    hour: string;
  }[];
  assignmentCount: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconSchool className="h-5 w-5" />
            Mes classes
          </CardTitle>
          <CardDescription>
            {loading
              ? "Chargement…"
              : `${classes.length} classe${classes.length > 1 ? "s" : ""} · ${assignmentCount} cours assigné${assignmentCount > 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : classes.length > 0 ? (
            <ul className="space-y-2">
              {classes.map((classe) => (
                <li key={classe.id} className="text-sm font-medium">
                  {classe.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune classe assignée pour l&apos;année en cours
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCalendar className="h-5 w-5" />
            Cours du jour
          </CardTitle>
          <CardDescription>Mon horaire aujourd&apos;hui</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : todayCourses.length > 0 ? (
            <ul className="space-y-3">
              {todayCourses.map((course) => (
                <li
                  key={course.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-medium">{course.courseName}</p>
                    <p className="text-xs text-muted-foreground">
                      {course.className}
                    </p>
                  </div>
                  <Badge variant="outline">{course.hour}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun cours planifié aujourd&apos;hui
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StudentIdentitySection({
  loading,
  name,
  className,
  schoolYear,
  studentLabel,
}: {
  loading: boolean;
  name: string | null;
  className: string | null;
  schoolYear: string | null;
  studentLabel: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <BranchStatCard
        label="Identité"
        value={loading ? "—" : name || "—"}
        description={studentLabel}
        icon={IconUsers}
      />
      <BranchStatCard
        label="Classe"
        value={loading ? "—" : className || "Non inscrit"}
        description="Année en cours"
        icon={IconSchool}
      />
      <BranchStatCard
        label="Année scolaire"
        value={loading ? "—" : schoolYear || "—"}
        description="Année active"
        icon={IconCalendar}
      />
    </div>
  );
}

export function ParentChildrenSection({
  loading,
  children,
}: {
  loading: boolean;
  children: { id: string; name: string; className: string | null }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconUsers className="h-5 w-5" />
          Mes enfants
        </CardTitle>
        <CardDescription>
          {loading
            ? "Chargement…"
            : `${children.length} enfant${children.length > 1 ? "s" : ""} lié${children.length > 1 ? "s" : ""}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : children.length > 0 ? (
          <ul className="space-y-3">
            {children.map((child) => (
              <li
                key={child.id}
                className="flex items-center justify-between gap-2"
              >
                <p className="text-sm font-medium">{child.name || "—"}</p>
                <Badge variant="outline">{child.className ?? "Sans classe"}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun enfant lié à ce compte sur cette branche
          </p>
        )}
      </CardContent>
    </Card>
  );
}
