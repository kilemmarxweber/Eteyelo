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
  IconChevronRight,
  IconUser,
  IconMoodSmile,
} from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

const SHORTCUT_TONES: Record<
  string,
  {
    card: string;
    hoverBorder: string;
    chevron: string;
    accent: string;
  }
> = {
  "bg-blue-500": {
    card: "border-blue-500/25 from-blue-500/[0.07] dark:border-blue-400/20 dark:from-blue-400/[0.08]",
    hoverBorder: "hover:border-blue-500/40",
    chevron: "group-hover:text-blue-600 dark:group-hover:text-blue-400",
    accent: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  "bg-indigo-500": {
    card: "border-indigo-500/25 from-indigo-500/[0.07] dark:border-indigo-400/20 dark:from-indigo-400/[0.08]",
    hoverBorder: "hover:border-indigo-500/40",
    chevron: "group-hover:text-indigo-600 dark:group-hover:text-indigo-400",
    accent:
      "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  "bg-purple-500": {
    card: "border-purple-500/25 from-purple-500/[0.07] dark:border-purple-400/20 dark:from-purple-400/[0.08]",
    hoverBorder: "hover:border-purple-500/40",
    chevron: "group-hover:text-purple-600 dark:group-hover:text-purple-400",
    accent:
      "border-purple-500/25 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
  "bg-emerald-500": {
    card: "border-emerald-500/25 from-emerald-500/[0.07] dark:border-emerald-400/20 dark:from-emerald-400/[0.08]",
    hoverBorder: "hover:border-emerald-500/40",
    chevron: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
    accent:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  "bg-orange-500": {
    card: "border-orange-500/25 from-orange-500/[0.07] dark:border-orange-400/20 dark:from-orange-400/[0.08]",
    hoverBorder: "hover:border-orange-500/40",
    chevron: "group-hover:text-orange-600 dark:group-hover:text-orange-400",
    accent:
      "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  "bg-amber-500": {
    card: "border-amber-500/25 from-amber-500/[0.07] dark:border-amber-400/20 dark:from-amber-400/[0.08]",
    hoverBorder: "hover:border-amber-500/40",
    chevron: "group-hover:text-amber-600 dark:group-hover:text-amber-400",
    accent:
      "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  "bg-violet-500": {
    card: "border-violet-500/25 from-violet-500/[0.07] dark:border-violet-400/20 dark:from-violet-400/[0.08]",
    hoverBorder: "hover:border-violet-500/40",
    chevron: "group-hover:text-violet-600 dark:group-hover:text-violet-400",
    accent:
      "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  "bg-teal-500": {
    card: "border-teal-500/25 from-teal-500/[0.07] dark:border-teal-400/20 dark:from-teal-400/[0.08]",
    hoverBorder: "hover:border-teal-500/40",
    chevron: "group-hover:text-teal-600 dark:group-hover:text-teal-400",
    accent: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  "bg-green-500": {
    card: "border-green-500/25 from-green-500/[0.07] dark:border-green-400/20 dark:from-green-400/[0.08]",
    hoverBorder: "hover:border-green-500/40",
    chevron: "group-hover:text-green-600 dark:group-hover:text-green-400",
    accent:
      "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300",
  },
  "bg-slate-500": {
    card: "border-slate-500/25 from-slate-500/[0.07] dark:border-slate-400/20 dark:from-slate-400/[0.08]",
    hoverBorder: "hover:border-slate-500/40",
    chevron: "group-hover:text-slate-600 dark:group-hover:text-slate-300",
    accent:
      "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
};

const DEFAULT_SHORTCUT_TONE = SHORTCUT_TONES["bg-slate-500"];

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
        const tone = SHORTCUT_TONES[action.color] ?? DEFAULT_SHORTCUT_TONE;
        const amounts = action.amounts;
        const paidRatio =
          amounts && amounts.totalDue > 0
            ? Math.min(
                1,
                Math.max(
                  0,
                  (amounts.totalDue - amounts.totalRemaining) / amounts.totalDue,
                ),
              )
            : amounts && amounts.totalRemaining <= 0
              ? 1
              : 0;
        const isSettled = Boolean(amounts && amounts.totalRemaining <= 0);

        return (
          <Link key={`${action.href}-${action.title}`} href={action.href}>
            <Card
              className={cn(
                "group h-full overflow-hidden bg-gradient-to-br via-card to-card",
                "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md",
                tone.card,
                tone.hoverBorder,
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className={cn(
                      "rounded-lg p-2 text-white shadow-sm",
                      action.color,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-medium leading-none">
                      {action.title}
                    </CardTitle>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {amounts
                        ? isSettled
                          ? "Situation à jour"
                          : "Solde des enfants"
                        : "Accès rapide"}
                    </p>
                  </div>
                </div>
                <IconChevronRight
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5",
                    tone.chevron,
                  )}
                />
              </CardHeader>
              <CardContent className="space-y-2.5 pt-0">
                {amounts ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-border/70 bg-background/70 px-2 py-1.5 dark:bg-background/40">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          À payer
                        </p>
                        <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">
                          {formatReportAmountCurrencyFirst(
                            amounts.totalDue,
                            amounts.currency,
                          )}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "rounded-md border px-2 py-1.5",
                          isSettled
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-amber-500/30 bg-amber-500/10",
                        )}
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Reste
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 truncate text-sm font-semibold tabular-nums",
                            isSettled
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-amber-700 dark:text-amber-300",
                          )}
                        >
                          {formatReportAmountCurrencyFirst(
                            amounts.totalRemaining,
                            amounts.currency,
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isSettled ? "bg-emerald-500" : "bg-amber-500",
                          )}
                          style={{ width: `${Math.round(paidRatio * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {Math.round(paidRatio * 100)}% réglé
                      </p>
                    </div>
                  </>
                ) : (
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border px-2.5 py-2",
                      tone.accent,
                    )}
                  >
                    <p className="min-w-0 truncate text-xs font-medium">
                      {action.description}
                    </p>
                    <IconChevronRight className="size-3.5 shrink-0 opacity-70" />
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export function ParentSatisfactionSection({
  loading,
  satisfaction,
}: {
  loading: boolean;
  satisfaction: {
    percentage: number;
    feedbackCount: number;
    schoolYearLabel: string | null;
    myAverageRating: number | null;
    myFeedbackCount: number;
  } | null;
}) {
  const percentage = satisfaction?.percentage ?? 0;
  const feedbackCount = satisfaction?.feedbackCount ?? 0;
  const yearLabel = satisfaction?.schoolYearLabel ?? "année en cours";
  const tone =
    percentage >= 75
      ? "emerald"
      : percentage >= 50
        ? "amber"
        : feedbackCount > 0
          ? "rose"
          : "violet";

  const tones = {
    emerald: {
      card: "border-emerald-500/25 from-emerald-500/[0.07] dark:border-emerald-400/20 dark:from-emerald-400/[0.08]",
      icon: "bg-emerald-500",
      badge:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      bar: "bg-emerald-500",
      value: "text-emerald-700 dark:text-emerald-300",
    },
    amber: {
      card: "border-amber-500/25 from-amber-500/[0.07] dark:border-amber-400/20 dark:from-amber-400/[0.08]",
      icon: "bg-amber-500",
      badge:
        "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      bar: "bg-amber-500",
      value: "text-amber-800 dark:text-amber-300",
    },
    rose: {
      card: "border-rose-500/25 from-rose-500/[0.07] dark:border-rose-400/20 dark:from-rose-400/[0.08]",
      icon: "bg-rose-500",
      badge:
        "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      bar: "bg-rose-500",
      value: "text-rose-700 dark:text-rose-300",
    },
    violet: {
      card: "border-violet-500/25 from-violet-500/[0.07] dark:border-violet-400/20 dark:from-violet-400/[0.08]",
      icon: "bg-violet-500",
      badge:
        "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
      bar: "bg-violet-500",
      value: "text-violet-700 dark:text-violet-300",
    },
  }[tone];

  return (
    <Card
      className={cn(
        "overflow-hidden bg-gradient-to-br via-card to-card",
        tones.card,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "rounded-lg p-2 text-white shadow-sm",
                tones.icon,
              )}
            >
              <IconMoodSmile className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-medium leading-none">
                Satisfaction annuelle
              </CardTitle>
              <CardDescription className="mt-1 text-[11px]">
                Avis parents · {yearLabel}
              </CardDescription>
            </div>
          </div>
          {!loading && feedbackCount > 0 ? (
            <Badge variant="outline" className={cn("shrink-0 text-[10px]", tones.badge)}>
              {feedbackCount} avis
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {loading ? (
          <div className={cn("rounded-md border px-2.5 py-2 text-xs font-medium", tones.badge)}>
            Chargement…
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <p className={cn("text-4xl font-black tabular-nums", tones.value)}>
                {feedbackCount > 0 ? `${percentage}%` : "—"}
              </p>
              <p className="max-w-[12rem] text-right text-[11px] text-muted-foreground">
                {feedbackCount > 0
                  ? "Part des avis favorables (≥ 4/5) sur l’année"
                  : "Aucun avis parent enregistré cette année"}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", tones.bar)}
                style={{
                  width: `${feedbackCount > 0 ? Math.min(100, Math.max(0, percentage)) : 0}%`,
                }}
              />
            </div>
            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs",
                tones.badge,
              )}
            >
              <span className="font-medium">Votre moyenne</span>
              <span className="tabular-nums font-semibold">
                {satisfaction?.myFeedbackCount
                  ? `${satisfaction.myAverageRating}/5 · ${satisfaction.myFeedbackCount} mois`
                  : "Pas encore d’avis"}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
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
    <Card className="overflow-hidden border-blue-500/25 bg-gradient-to-br from-blue-500/[0.07] via-card to-card dark:border-blue-400/20 dark:from-blue-400/[0.08]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="rounded-lg bg-blue-500 p-2 text-white shadow-sm">
              <IconCalendar className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-medium leading-none">
                Prochains événements
              </CardTitle>
              <CardDescription className="mt-1 text-[11px]">
                À venir dans votre {branchTypeLabel.toLowerCase()}
              </CardDescription>
            </div>
          </div>
          {upcomingEvents.length > 0 ? (
            <Badge
              variant="outline"
              className="shrink-0 border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-700 dark:text-blue-300"
            >
              {upcomingEvents.length}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => {
              const eventDate = new Date(event.dateStart);
              const diffDays = Math.ceil(
                (eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              const isToday = diffDays === 0;

              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/70 px-2.5 py-2 dark:bg-background/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {event.title || "Événement"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {eventDate.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] font-medium",
                      isToday
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                    )}
                  >
                    {isToday
                      ? "Aujourd'hui"
                      : `Dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`}
                  </Badge>
                </div>
              );
            })
          ) : (
            <div className="rounded-md border border-blue-500/25 bg-blue-500/10 px-2.5 py-2 text-xs font-medium text-blue-700 dark:text-blue-300">
              Aucun événement à venir
            </div>
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
        description="Inscriptions avec solde (année en cours)"
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
  const params = useParams<{ organizationId: string; branchId: string }>();
  const scheduleBase =
    params.organizationId && params.branchId
      ? `/admin/organizations/${params.organizationId}/branches/${params.branchId}/schedule`
      : null;

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
                <li key={classe.id}>
                  {scheduleBase ? (
                    <Link
                      href={`${scheduleBase}/${classe.id}`}
                      className="group flex items-center justify-between gap-2 text-sm font-medium hover:text-primary"
                    >
                      <span>{classe.name}</span>
                      <IconChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">{classe.name}</span>
                  )}
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

const CHILD_CARD_TONES = [
  {
    card: "border-sky-500/25 from-sky-500/[0.08] hover:border-sky-500/40 dark:border-sky-400/20 dark:from-sky-400/[0.1]",
    avatar: "bg-sky-500 text-white shadow-sm",
    chevron: "group-hover:text-sky-600 dark:group-hover:text-sky-400",
    pill: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    card: "border-emerald-500/25 from-emerald-500/[0.08] hover:border-emerald-500/40 dark:border-emerald-400/20 dark:from-emerald-400/[0.1]",
    avatar: "bg-emerald-500 text-white shadow-sm",
    chevron: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
    pill: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    card: "border-violet-500/25 from-violet-500/[0.08] hover:border-violet-500/40 dark:border-violet-400/20 dark:from-violet-400/[0.1]",
    avatar: "bg-violet-500 text-white shadow-sm",
    chevron: "group-hover:text-violet-600 dark:group-hover:text-violet-400",
    pill: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  {
    card: "border-amber-500/25 from-amber-500/[0.08] hover:border-amber-500/40 dark:border-amber-400/20 dark:from-amber-400/[0.1]",
    avatar: "bg-amber-500 text-white shadow-sm",
    chevron: "group-hover:text-amber-600 dark:group-hover:text-amber-400",
    pill: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
] as const;

export function ParentChildrenSection({
  loading,
  children,
}: {
  loading: boolean;
  children: { id: string; name: string; className: string | null }[];
}) {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const organizationId = params.organizationId;
  const branchId = params.branchId;

  return (
    <Card className="overflow-hidden border-violet-500/25 bg-gradient-to-br from-violet-500/[0.07] via-card to-card dark:border-violet-400/20 dark:from-violet-400/[0.08]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="rounded-lg bg-violet-500 p-2 text-white shadow-sm">
              <IconUsers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-medium leading-none">
                Mes enfants
              </CardTitle>
              <CardDescription className="mt-1 text-[11px]">
                {loading
                  ? "Chargement…"
                  : "Cliquez une carte pour ouvrir la fiche"}
              </CardDescription>
            </div>
          </div>
          {!loading && children.length > 0 ? (
            <Badge
              variant="outline"
              className="shrink-0 border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-700 dark:text-violet-300"
            >
              {children.length}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="rounded-md border border-violet-500/25 bg-violet-500/10 px-2.5 py-2 text-xs font-medium text-violet-700 dark:text-violet-300">
            Chargement…
          </div>
        ) : children.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {children.map((child, index) => {
              const href = `/admin/organizations/${organizationId}/branches/${branchId}/student/${child.id}`;
              const tone = CHILD_CARD_TONES[index % CHILD_CARD_TONES.length];
              const initials = (child.name || "?")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("");

              return (
                <Link
                  key={child.id}
                  href={href}
                  className={cn(
                    "group flex min-w-[200px] max-w-full flex-1 items-center gap-2.5 rounded-lg border bg-gradient-to-br via-card to-card px-2.5 py-2 shadow-sm transition sm:max-w-[260px]",
                    "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    tone.card,
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
                      tone.avatar,
                    )}
                  >
                    {initials || <IconUser className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight text-foreground">
                      {child.name || "—"}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 inline-flex max-w-full truncate rounded border px-1.5 py-0.5 text-[10px] font-medium",
                        tone.pill,
                      )}
                    >
                      {child.className ?? "Sans classe"}
                    </p>
                  </div>
                  <IconChevronRight
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5",
                      tone.chevron,
                    )}
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-violet-500/25 bg-violet-500/10 px-2.5 py-2 text-xs font-medium text-violet-700 dark:text-violet-300">
            Aucun enfant lié à ce compte sur cette branche
          </div>
        )}
      </CardContent>
    </Card>
  );
}
