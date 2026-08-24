"use client";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { BranchLoadingFallback } from "@/components/branch-loading-fallback";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconChartBar } from "@tabler/icons-react";
import {
  createParentFeedback,
  getBranchDashboardData,
} from "./admin-stats";
import { useEffect, useMemo, useState } from "react";
import { getPeopleVariant } from "@/lib/people-variant";
import {
  getBranchCapabilities,
  getClassDisplayLabelPlural,
  hidesParentManagement,
  usesFinanceForBranch,
} from "@/lib/branch-capabilities";
import { cn } from "@/lib/utils";
import type { DashboardVariant } from "@/lib/auth/dashboard-variant";
import {
  getDashboardShortcuts,
  overviewDescriptionForVariant,
} from "./dashboard-shortcuts";
import {
  CashierStatsSection,
  EventsSection,
  ParentChildrenSection,
  ParentSatisfactionSection,
  ParentAnnouncementsSection,
  PedagogyMetricsSection,
  SchoolStatsSection,
  ShortcutsSection,
  StudentIdentitySection,
  TeacherSpaceSection,
} from "./dashboard-sections";
import { AbsenceDashboardSection } from "@/components/absence-dashboard-card";

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
  } | null;
};

type DashboardMetrics = {
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

const EMPTY_METRICS: DashboardMetrics = {
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
};

export default function AdminDashboard() {
  const t = useTranslations("dashboard");
  const tPeopleAll = useTranslations("people");
  const tReg = useTranslations("registration");
  const params = useParams();
  const organizationId = params.organizationId as string;
  const branchId = params.branchId as string;

  /** null tant que la session n'a pas résolu le rôle — évite le flash « minimal ». */
  const [variant, setVariant] = useState<DashboardVariant | null>(null);
  const [canAccessFinance, setCanAccessFinance] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [events, setEvents] = useState<any[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [cashier, setCashier] = useState<{
    todayIncome: number;
    todayCount: number;
    todayExpenses?: number;
    netBalance?: number;
    unpaidInvoices: number;
    currency: string;
    scopedToSelf?: boolean;
  } | null>(null);
  const [teacher, setTeacher] = useState<{
    classes: { id: string; name: string }[];
    todayCourses: {
      id: string;
      courseName: string;
      className: string;
      hour: string;
    }[];
    assignmentCount: number;
  } | null>(null);
  const [student, setStudent] = useState<{
    studentId: string;
    name: string;
    className: string | null;
    schoolYear: string | null;
  } | null>(null);
  const [parent, setParent] = useState<{
    children: { id: string; name: string; className: string | null }[];
    finance?: {
      totalDue: number;
      totalPaid: number;
      totalRemaining: number;
      currency: string;
    } | null;
    satisfaction?: {
      percentage: number;
      feedbackCount: number;
      schoolYearLabel: string | null;
      myAverageRating: number | null;
      myFeedbackCount: number;
    } | null;
    announcements?: {
      id: string;
      title: string;
      description: string | null;
      dateStartLabel: string;
      audienceLabel: string;
      audienceScope: "all" | "class";
      eventTypeName: string | null;
    }[];
  } | null>(null);
  const [typebranchState, setTypebranchState] = useState<string | null>(null);

  const typebranch = stats?.typebranch ?? typebranchState ?? null;
  const peopleVariant = getPeopleVariant(typebranch);
  const peopleLabels = {
    student: tPeopleAll(`${peopleVariant}.student` as "school.student"),
    studentPlural: tPeopleAll(`${peopleVariant}.studentPlural` as "school.studentPlural"),
    studentLower: tPeopleAll(`${peopleVariant}.studentLower` as "school.studentLower"),
    studentPluralLower: tPeopleAll(
      `${peopleVariant}.studentPluralLower` as "school.studentPluralLower",
    ),
    teacherPlural: tPeopleAll(`${peopleVariant}.teacherPlural` as "school.teacherPlural"),
  };
  const capabilities = getBranchCapabilities(typebranch);
  const rawClassPlural = getClassDisplayLabelPlural(typebranch);
  const classLabelPlural = tReg(`classLabelsPlural.${rawClassPlural}` as never);
  const branchTypeKey = capabilities.typebranch;
  const branchTypeLabel = t(`branchTypes.${branchTypeKey}` as never);
  const showFinanceCapability = usesFinanceForBranch(typebranch);
  const showParents = !hidesParentManagement(typebranch);
  const showRevenue =
    canAccessFinance &&
    variant === "directeur" &&
    showFinanceCapability &&
    Boolean(stats?.revenue);

  const ready = !loading && variant != null;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getBranchDashboardData({ branchId, organizationId });
        if (cancelled) return;

        setVariant(data.variant);
        setCanAccessFinance(Boolean(data.canAccessFinance));
        setTypebranchState(data.typebranch ?? null);
        setStats(
          data.stats && typeof data.stats === "object"
            ? (data.stats as AdminStats)
            : null,
        );
        setMetrics(
          data.metrics && typeof data.metrics === "object"
            ? (data.metrics as DashboardMetrics)
            : null,
        );
        setEvents(Array.isArray(data.events) ? data.events : []);
        setCashier(data.cashier ?? null);
        setTeacher(data.teacher ?? null);
        setStudent(data.student ?? null);
        setParent(data.parent ?? null);

        const type = data.typebranch ?? (data.stats as AdminStats | null)?.typebranch;
        const feedback = data.feedbackStatus as
          | { showFeedbackPopup?: boolean }
          | null
          | undefined;
        if (
          data.variant === "parent" &&
          !hidesParentManagement(type) &&
          feedback?.showFeedbackPopup
        ) {
          setShowFeedback(true);
        } else {
          setShowFeedback(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setVariant(null);
          setLoadError(
            err instanceof Error ? err.message : t("loadError"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [branchId, organizationId, reloadToken, t]);

  const quickActions = useMemo(
    () =>
      variant
        ? getDashboardShortcuts(
            variant,
            {
              organizationId,
              branchId,
              studentPluralLower: peopleLabels.studentPluralLower,
              classLabelPlural,
              showFinance:
                showFinanceCapability &&
                ((variant === "directeur" && canAccessFinance) ||
                  variant === "parent"),
              parentFinance:
                variant === "parent" && parent?.finance
                  ? {
                      totalDue: parent.finance.totalDue,
                      totalRemaining: parent.finance.totalRemaining,
                      currency: parent.finance.currency,
                      firstChildId: parent.children[0]?.id ?? null,
                    }
                  : variant === "parent"
                    ? {
                        totalDue: 0,
                        totalRemaining: 0,
                        currency: "USD",
                        firstChildId: parent?.children[0]?.id ?? null,
                      }
                    : null,
              studentProfileId:
                variant === "student" ? (student?.studentId ?? null) : null,
            },
            (key, values) => t(key as never, values),
          )
        : [],
    [
      variant,
      organizationId,
      branchId,
      peopleLabels.studentPluralLower,
      classLabelPlural,
      showFinanceCapability,
      canAccessFinance,
      parent,
      student,
      t,
    ],
  );

  const studentTotal = stats?.students?.total ?? 0;
  const teacherTotal = stats?.teachers?.total ?? 0;
  const classTotal = stats?.classes?.total ?? 0;
  const enrollmentRate = stats?.students?.enrollmentRate ?? 0;
  const teacherActivityRate = stats?.teachers?.activityRate ?? 0;
  const classOccupancyRate = stats?.classes?.occupancyRate ?? 0;

  const overviewDescription = variant
    ? overviewDescriptionForVariant(
        variant,
        branchTypeLabel,
        capabilities.isSchoolBranch,
        (key, values) => t(key as never, values),
      )
    : t("loading");

  const showSchoolStats =
    variant === "directeur" ||
    variant === "prefet" ||
    variant === "directeur_etudes";
  const showPedagogyMetrics = showSchoolStats && metrics != null;
  const showEvents = ready && variant !== "parent";
  const showParentSatisfaction = ready && variant === "parent";
  const showParentAnnouncements = ready && variant === "parent";

  if (!ready) {
    if (loadError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => setReloadToken((n) => n + 1)}
          >
            {t("retry")}
          </button>
        </div>
      );
    }
    return (
      <BranchLoadingFallback label={t("loading")} />
    );
  }

  return (
    <>
      {showFeedback && showParents && variant === "parent" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md min-w-[320px] flex-shrink-0 rounded-2xl bg-white p-6 text-center shadow-xl">
            <h2 className="mb-5 text-lg font-bold">
              {t("feedback.title")}
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
                  {t("feedback.explain")}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="mt-2 w-full resize-none rounded-lg border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  rows={3}
                  placeholder={t("feedback.placeholder")}
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
                  setError(t("feedback.needExplain"));
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
                if (res?.satisfaction) {
                  setParent((prev) =>
                    prev
                      ? { ...prev, satisfaction: res.satisfaction }
                      : {
                          children: [],
                          satisfaction: res.satisfaction,
                        },
                  );
                } else {
                  try {
                    const data = await getBranchDashboardData({
                      branchId,
                      organizationId,
                    });
                    if (data.parent) setParent(data.parent);
                  } catch {
                    // ignore refresh errors — avis déjà enregistré
                  }
                }
                setShowFeedback(false);
                setSelectedRating(null);
                setComment("");
                setError("");
              }}
              className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white disabled:opacity-50"
            >
              {t("feedback.send")}
            </button>
          </div>
        </div>
      ) : null}

      <BranchPageShell
        title={t("title")}
        description={overviewDescription}
        badge={
          <Badge variant="outline-primary" icon={<IconChartBar size={14} />}>
            {branchTypeLabel}
          </Badge>
        }
        contentClassName="space-y-4"
      >
          {showSchoolStats ? (
            <SchoolStatsSection
              loading={loading}
              studentLabel={
                studentTotal === 1
                  ? peopleLabels.student
                  : peopleLabels.studentPlural
              }
              teacherLabel={peopleLabels.teacherPlural}
              classLabelPlural={classLabelPlural}
              studentTotal={studentTotal}
              teacherTotal={teacherTotal}
              classTotal={classTotal}
              enrollmentRate={enrollmentRate}
              teacherActivityRate={teacherActivityRate}
              classOccupancyRate={classOccupancyRate}
              studentChange={stats?.students?.change?.percentage}
              teacherChange={stats?.teachers?.change?.percentage}
              classChange={stats?.classes?.change?.percentage}
              showRevenue={showRevenue}
              revenueCurrent={stats?.revenue?.current}
              revenueCurrency={stats?.revenue?.currency}
              revenueChange={stats?.revenue?.percentageChange}
              selectedRatePair={stats?.selectedRatePair}
              baseCurrency={stats?.baseCurrency}
            />
          ) : null}

          {variant === "caissier" && cashier ? (
            <CashierStatsSection
              loading={loading}
              todayIncome={cashier.todayIncome}
              todayCount={cashier.todayCount}
              todayExpenses={cashier.todayExpenses}
              netBalance={cashier.netBalance}
              unpaidInvoices={cashier.unpaidInvoices}
              currency={cashier.currency}
              scopedToSelf={cashier.scopedToSelf}
            />
          ) : null}

          {variant === "teacher" ? (
            <TeacherSpaceSection
              loading={loading}
              classes={teacher?.classes ?? []}
              todayCourses={teacher?.todayCourses ?? []}
              assignmentCount={teacher?.assignmentCount ?? 0}
            />
          ) : null}

          {variant === "student" ? (
            <StudentIdentitySection
              loading={loading}
              name={student?.name ?? null}
              className={student?.className ?? null}
              schoolYear={student?.schoolYear ?? null}
              studentLabel={peopleLabels.student}
            />
          ) : null}

          <AbsenceDashboardSection />

          {variant === "parent" ? (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.9fr)]">
              <ParentChildrenSection
                loading={loading}
                childProfiles={parent?.children ?? []}
              />
              {showParentSatisfaction ? (
                <ParentSatisfactionSection
                  loading={loading}
                  satisfaction={parent?.satisfaction ?? null}
                />
              ) : null}
            </div>
          ) : null}

          <ShortcutsSection actions={quickActions} />

          <div
            className={cn(
              "grid gap-4",
              showPedagogyMetrics ? "md:grid-cols-2" : "md:grid-cols-1",
            )}
          >
            {showEvents ? (
              <EventsSection
                branchTypeLabel={branchTypeLabel}
                events={events}
              />
            ) : null}

            {showPedagogyMetrics ? (
              <PedagogyMetricsSection
                branchTypeLabel={branchTypeLabel}
                showParents={showParents}
                metrics={metrics ?? EMPTY_METRICS}
                studentsLabelLower={
                  (metrics?.studentsCount ?? 0) === 1
                    ? peopleLabels.studentLower
                    : peopleLabels.studentPluralLower
                }
              />
            ) : null}
          </div>

          {showParentAnnouncements ? (
            <ParentAnnouncementsSection
              loading={loading}
              announcements={parent?.announcements ?? []}
            />
          ) : null}
      </BranchPageShell>
    </>
  );
}
