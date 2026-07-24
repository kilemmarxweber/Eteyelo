"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { BranchStatCard } from "@/components/ui/branch-stat-card";
import { useParams } from "next/navigation";
import {
  IconUsers,
  IconSchool,
  IconBook,
  IconCurrencyDollar,
  IconChartBar,
  IconCalendar,
  IconChalkboardTeacher,
} from "@tabler/icons-react";
import {
  createParentFeedback,
  getBranchDashboardData,
  getDashboardMetrics,
} from "./admin-stats";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PEOPLE_LABELS,
  getPeopleLabels,
  pluralizeStudentLabel,
  pluralizeStudentLabelLower,
} from "@/lib/people-labels";
import {
  getBranchCapabilities,
  getBranchTypeLabel,
  getClassDisplayLabelPlural,
  hidesParentManagement,
  usesFinanceForBranch,
} from "@/lib/branch-capabilities";
import { formatReportAmountCurrencyFirst } from "@/lib/reports/format-amount";
import { cn } from "@/lib/utils";

type AdminStats = {
  typebranch?: string | null;
  baseCurrency?: string | null;
  quoteCurrency?: string | null;
  selectedRatePair?: string | null;
  error?: string;
  students?: {
    total: number;
    enrolled: number;
    enrollmentRate: number;
    change: { percentage: number };
  };
  teachers?: {
    total: number;
    active: number;
    activityRate: number;
    change: { percentage: number };
  };
  classes?: {
    total: number;
    active: number;
    occupancyRate: number;
    change: { percentage: number };
  };
  revenue?: {
    current: number;
    percentageChange: number;
    currency?: string;
  };
};

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

export default function AdminDashboard() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const branchId = params.branchId as string;

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({
    attendance: 0,
    attendanceCount: 0,
    successRate: 0,
    averageScore: 0,
    studentsCount: 0,
    passedCount: 0,
    satisfaction: 0,
    feedbackCount: 0,
    parentsCount: 0,
    responseRate: 0,
  });

  const typebranch = stats?.typebranch ?? null;
  const peopleLabels = typebranch
    ? getPeopleLabels(typebranch)
    : DEFAULT_PEOPLE_LABELS;
  const capabilities = getBranchCapabilities(typebranch);
  const classLabelPlural = getClassDisplayLabelPlural(typebranch);
  const branchTypeLabel = getBranchTypeLabel(typebranch);
  const showFinance = usesFinanceForBranch(typebranch);
  const showParents = !hidesParentManagement(typebranch);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await getBranchDashboardData({ branchId, organizationId });
        if (cancelled) return;

        setStats(data.stats as AdminStats);
        if (data.metrics && typeof data.metrics === "object") {
          setMetrics((prev) => ({ ...prev, ...data.metrics }));
        }
        setEvents(Array.isArray(data.events) ? data.events : []);

        const type = (data.stats as AdminStats | null)?.typebranch;
        const feedback = data.feedbackStatus as
          | { showFeedbackPopup?: boolean }
          | null
          | undefined;
        if (
          !hidesParentManagement(type) &&
          feedback?.showFeedbackPopup
        ) {
          setShowFeedback(true);
        } else {
          setShowFeedback(false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [branchId, organizationId]);

  const quickActions = useMemo(() => {
    const actions = [
      {
        title: `Gérer les ${peopleLabels.studentPluralLower}`,
        description: `Ajouter, modifier ou archiver des ${peopleLabels.studentPluralLower}`,
        icon: <IconUsers className="h-6 w-6" />,
        href: "/admin/student",
        color: "bg-blue-500",
      },
      {
        title: `Gérer les ${classLabelPlural.toLowerCase()}`,
        description: `Créer et organiser les ${classLabelPlural.toLowerCase()}`,
        icon: <IconSchool className="h-6 w-6" />,
        href: "/admin/classe",
        color: "bg-green-500",
      },
      {
        title: "Gérer les cours",
        description: "Configurer les cours et matières",
        icon: <IconBook className="h-6 w-6" />,
        href: "/admin/cours",
        color: "bg-purple-500",
      },
    ];

    if (showFinance) {
      actions.push({
        title: "Gérer les frais",
        description: capabilities.isSchoolBranch
          ? "Configurer les frais scolaires"
          : "Configurer les frais et paiements",
        icon: <IconCurrencyDollar className="h-6 w-6" />,
        href: "/admin/frais",
        color: "bg-orange-500",
      });
    }

    return actions;
  }, [
    peopleLabels.studentPluralLower,
    classLabelPlural,
    showFinance,
    capabilities.isSchoolBranch,
  ]);

  const studentTotal = stats?.students?.total ?? 0;
  const teacherTotal = stats?.teachers?.total ?? 0;
  const classTotal = stats?.classes?.total ?? 0;
  const enrollmentRate = stats?.students?.enrollmentRate ?? 0;
  const teacherActivityRate = stats?.teachers?.activityRate ?? 0;
  const classOccupancyRate = stats?.classes?.occupancyRate ?? 0;

  const upcomingEvents = events
    .filter((event) => new Date(event.dateStart).getTime() >= Date.now())
    .sort(
      (a, b) =>
        new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime(),
    )
    .slice(0, 5);

  const overviewDescription = capabilities.isSchoolBranch
    ? `Vue d'ensemble de votre établissement (${branchTypeLabel})`
    : `Vue d'ensemble de votre ${branchTypeLabel.toLowerCase()}`;

  return (
    <>
      {showFeedback && showParents ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md min-w-[320px] flex-shrink-0 rounded-2xl bg-white p-6 text-center shadow-xl">
            <h2 className="mb-5 text-lg font-bold">
              Comment trouvez-vous l’établissement ?
            </h2>

            <div className="mb-6 flex items-center justify-between gap-2">
              {[
                { value: 1, icon: "😡" },
                { value: 2, icon: "😕" },
                { value: 3, icon: "😐" },
                { value: 4, icon: "😊" },
                { value: 5, icon: "😍" },
              ].map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setSelectedRating(e.value)}
                  className={cn(
                    "text-4xl transition-transform hover:scale-110 active:scale-95",
                    selectedRating === e.value && "scale-110",
                  )}
                >
                  {e.icon}
                </button>
              ))}
            </div>

            {selectedRating === 1 ? (
              <div className="mb-4 text-left">
                <label className="text-sm font-medium text-red-600">
                  Expliquez pourquoi vous êtes insatisfait *
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="mt-2 w-full resize-none rounded-lg border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  rows={3}
                  placeholder="Décrivez le problème..."
                />
                {error ? (
                  <p className="mt-1 text-xs text-red-500">{error}</p>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              disabled={!selectedRating}
              onClick={async () => {
                if (!selectedRating) return;
                if (selectedRating === 1 && comment.trim().length < 5) {
                  setError("Veuillez expliquer votre insatisfaction");
                  return;
                }
                setError("");
                const res = await createParentFeedback(
                  selectedRating,
                  selectedRating === 1 ? comment : null,
                );
                if (res?.error) {
                  setError(res.error);
                  return;
                }
                setShowFeedback(false);
                setSelectedRating(null);
                setComment("");
                setError("");
                const [data, err] = await getDashboardMetrics();
                if (!err) setMetrics(data);
              }}
              className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white disabled:opacity-50"
            >
              Envoyer
            </button>
          </div>
        </div>
      ) : null}

      <Layout>
        <LayoutBody className="space-y-4">
          <PageHeader
            title="Tableau de bord"
            description={overviewDescription}
            badge={
              <Badge
                variant="outline-primary"
                icon={<IconChartBar size={14} />}
              >
                {branchTypeLabel}
              </Badge>
            }
            className="mb-0 space-y-1"
          />

          <div
            className={cn(
              "grid gap-4 sm:grid-cols-2",
              showFinance ? "xl:grid-cols-4" : "xl:grid-cols-3",
            )}
          >
            <BranchStatCard
              label={pluralizeStudentLabel(peopleLabels, studentTotal)}
              value={loading ? "—" : studentTotal}
              description={`${enrollmentRate}% inscrits · ${formatSignedPercent(stats?.students?.change?.percentage)} vs mois dernier`}
              icon={IconUsers}
            />
            <BranchStatCard
              label={peopleLabels.teacherPlural}
              value={loading ? "—" : teacherTotal}
              description={`${teacherActivityRate}% actifs · ${formatSignedPercent(stats?.teachers?.change?.percentage)} vs mois dernier`}
              icon={IconChalkboardTeacher}
            />
            <BranchStatCard
              label={classLabelPlural}
              value={loading ? "—" : classTotal}
              description={`${classOccupancyRate}% occupés · ${formatSignedPercent(stats?.classes?.change?.percentage)} vs mois dernier`}
              icon={IconSchool}
            />
            {showFinance ? (
              <BranchStatCard
                label={`Revenus (${stats?.revenue?.currency ?? stats?.baseCurrency ?? "…"})`}
                value={
                  loading
                    ? "—"
                    : formatReportAmountCurrencyFirst(
                        Number(stats?.revenue?.current ?? 0),
                        stats?.revenue?.currency ??
                          stats?.baseCurrency ??
                          "USD",
                      )
                }
                description={
                  stats?.selectedRatePair
                    ? `Base ${stats.selectedRatePair} · ${formatSignedPercent(stats?.revenue?.percentageChange)} vs mois dernier`
                    : `${formatSignedPercent(stats?.revenue?.percentageChange)} vs mois dernier`
                }
                icon={IconCurrencyDollar}
              />
            ) : null}
          </div>

          <div
            className={cn(
              "grid gap-4 md:grid-cols-2",
              quickActions.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
            )}
          >
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                    <div
                      className={`rounded-lg p-2 text-white ${action.color}`}
                    >
                      {action.icon}
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
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
                        (eventDate.getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24),
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconChartBar className="h-5 w-5" />
                  Métriques de performance
                </CardTitle>
                <CardDescription>
                  Indicateurs clés — {branchTypeLabel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Taux de présence
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.attendanceCount > 0
                          ? `${metrics.attendance}%`
                          : "—"}
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
                      <span className="text-sm font-medium">
                        Moyenne générale
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.studentsCount > 0
                          ? `${metrics.averageScore}%`
                          : "—"}
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
                        ? `Réussite ${metrics.successRate}% · ${metrics.passedCount}/${metrics.studentsCount} ${pluralizeStudentLabelLower(peopleLabels, metrics.studentsCount)} ≥ 50%`
                        : "Aucune cote enregistrée pour le moment"}
                    </p>
                  </div>

                  {showParents ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Satisfaction parents
                        </span>
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
          </div>
        </LayoutBody>
      </Layout>
    </>
  );
}
