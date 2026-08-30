"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { intlLocaleFromUserLocale, normalizeUserLocale } from "@/lib/user-locale";
import {
  Briefcase,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileDown,
  FileText,
  Loader2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

import { DocumentReadViewer } from "@/components/documents/document-read-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  CANDIDATURE_PREFILL_EVENT,
  type PrefillEventDetail,
} from "@/lib/prefill-events";
import type { JobApplicationListItem } from "@/src/interfaces/JobApplication";
import {
  acceptJobApplicationAction,
  getJobApplicationDetailAction,
  getJobApplicationReportContextAction,
  getJobApplicationsAction,
  hireJobApplicationAction,
  rejectJobApplicationAction,
  reviewJobApplicationAction,
} from "@/app/components/depot-candidature/job-application.actions";
import {
  downloadCandidatureDossierPdf,
  exportCandidaturesReportPdf,
  type CandidaturePdfLabels,
  type CandidatureStatusFilter,
} from "./export-candidatures-pdf";

const STATUS_FILTER_VALUES: CandidatureStatusFilter[] = [
  "ALL",
  "PENDING",
  "REVIEWED",
  "ACCEPTED",
  "HIRED",
  "REJECTED",
];

const STATUS_CARD_VALUES = [
  "PENDING",
  "REVIEWED",
  "ACCEPTED",
  "HIRED",
  "REJECTED",
] as const;

function buildPdfLabels(
  t: ReturnType<typeof useTranslations<"candidatures">>,
  tCommon: ReturnType<typeof useTranslations<"common">>,
): CandidaturePdfLabels {
  return {
    statusLabels: {
      PENDING: t("status.PENDING"),
      REVIEWED: t("status.REVIEWED"),
      ACCEPTED: t("status.ACCEPTED"),
      HIRED: t("status.HIRED"),
      REJECTED: t("status.REJECTED"),
      CANCELLED: t("status.CANCELLED"),
    },
    allStatuses: t("pdf.allStatuses"),
    listTitle: t("pdf.listTitle"),
    // Templates with {status}/{date}/… are filled later in the PDF exporter.
    listTitleFiltered: String(t.raw("pdf.listTitleFiltered")),
    statusFilter: String(t.raw("pdf.statusFilter")),
    dossierTitle: t("pdf.dossierTitle"),
    reference: String(t.raw("pdf.reference")),
    statusLabel: String(t.raw("pdf.statusLabel")),
    depositedOn: String(t.raw("pdf.depositedOn")),
    statusBanner: String(t.raw("pdf.statusBanner")),
    candidateIdentity: t("pdf.candidateIdentity"),
    fullName: t("pdf.fullName"),
    phone: t("fields.phone"),
    typeTeacher: t("applicationType.TEACHER"),
    typeStaff: t("applicationType.STAFF"),
    gender: t("pdf.gender"),
    genderMale: tCommon("person.male"),
    genderFemale: tCommon("person.female"),
    birthDate: t("pdf.birthDate"),
    address: t("pdf.address"),
    profileSought: t("pdf.profileSought"),
    profileRole: t("pdf.profileRole"),
    yearsExperience: t("pdf.yearsExperience"),
    availability: t("fields.availability"),
    experience: t("fields.experience"),
    education: t("fields.education"),
    skills: t("fields.skills"),
    motivation: t("fields.motivation"),
    rejectReason: t("pdf.rejectReason"),
    timelineTitle: t("pdf.timelineTitle"),
    timelineDeposit: String(t.raw("pdf.timelineDeposit")),
    timelineReview: String(t.raw("pdf.timelineReview")),
    timelineAccept: String(t.raw("pdf.timelineAccept")),
    timelineHire: String(t.raw("pdf.timelineHire")),
    timelineReject: String(t.raw("pdf.timelineReject")),
    applicationCount: String(t.raw("pdf.applicationCount")),
    columns: {
      index: t("pdf.columns.index"),
      reference: t("pdf.columns.reference"),
      identity: t("pdf.columns.identity"),
      type: t("pdf.columns.type"),
      profile: t("pdf.columns.profile"),
      status: t("pdf.columns.status"),
      date: t("pdf.columns.date"),
    },
  };
}

function statusTone(status: string) {
  switch (status) {
    case "PENDING":
      return {
        badge:
          "border-amber-400/60 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        icon: Clock3,
        card: "border-l-amber-400",
      };
    case "REVIEWED":
      return {
        badge:
          "border-sky-400/60 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
        icon: Eye,
        card: "border-l-sky-400",
      };
    case "ACCEPTED":
      return {
        badge:
          "border-emerald-400/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        icon: CheckCircle2,
        card: "border-l-emerald-400",
      };
    case "HIRED":
      return {
        badge:
          "border-teal-500/60 bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
        icon: UserCheck,
        card: "border-l-teal-500",
      };
    case "REJECTED":
      return {
        badge:
          "border-red-400/60 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
        icon: XCircle,
        card: "border-l-red-400",
      };
    default:
      return {
        badge:
          "border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
        icon: Briefcase,
        card: "border-l-slate-300",
      };
  }
}

function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const tone = statusTone(status);
  const Icon = tone.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 gap-1 px-2 text-[11px] font-semibold",
        tone.badge,
      )}
    >
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

export function CandidaturesView({
  initialApplicationId = "",
}: {
  initialApplicationId?: string;
}) {
  const t = useTranslations("candidatures");
  const tCommon = useTranslations("common");
  const locale = intlLocaleFromUserLocale(normalizeUserLocale(useLocale()));
  const pdfLabels = useMemo(
    () => buildPdfLabels(t, tCommon),
    [t, tCommon],
  );
  const statusLabel = useCallback(
    (status: string) =>
      t(`status.${status}` as "status.PENDING") ?? status,
    [t],
  );
  const statusFilters = useMemo(
    () =>
      STATUS_FILTER_VALUES.map((value) => ({
        value,
        label: statusLabel(value),
      })),
    [statusLabel],
  );
  const requestedApplicationId = initialApplicationId;
  const [applications, setApplications] = useState<JobApplicationListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CandidatureStatusFilter>("ALL");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDossier, setExportingDossier] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [docViewer, setDocViewer] = useState<"cv" | "coverLetter" | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const base: Record<CandidatureStatusFilter, number> = {
      ALL: applications.length,
      PENDING: 0,
      REVIEWED: 0,
      ACCEPTED: 0,
      HIRED: 0,
      REJECTED: 0,
    };
    for (const application of applications) {
      const key = application.status as CandidatureStatusFilter;
      if (key in base && key !== "ALL") base[key] += 1;
    }
    return base;
  }, [applications]);

  const filteredApplications = useMemo(() => {
    if (statusFilter === "ALL") return applications;
    return applications.filter((item) => item.status === statusFilter);
  }, [applications, statusFilter]);

  const loadApplications = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    const scrollY =
      typeof window !== "undefined" ? window.scrollY : 0;
    const [data, error] = await getJobApplicationsAction();
    if (error) {
      toast.error(error.message);
      if (!opts?.soft) setLoading(false);
      return;
    }
    setApplications((data ?? []) as JobApplicationListItem[]);
    if (!opts?.soft) setLoading(false);
    if (opts?.soft && typeof window !== "undefined") {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior });
      });
    }
  }, []);

  const openDetail = useCallback(async (applicationId: string) => {
    setActionId(applicationId);
    const [data, error] = await getJobApplicationDetailAction({
      applicationId,
    });
    setActionId("");
    if (error) return toast.error(error.message);
    setDetail(data);
    setDetailOpen(true);
  }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    if (!requestedApplicationId) return;
    void openDetail(requestedApplicationId);
  }, [requestedApplicationId, openDetail]);

  useEffect(() => {
    function onPrefillEvent(event: Event) {
      const detail = (event as CustomEvent<PrefillEventDetail>).detail;
      if (!detail?.id) return;
      void openDetail(detail.id);
    }
    window.addEventListener(CANDIDATURE_PREFILL_EVENT, onPrefillEvent);
    return () => {
      window.removeEventListener(CANDIDATURE_PREFILL_EVENT, onPrefillEvent);
    };
  }, [openDetail]);

  function runAction(
    applicationId: string,
    action: () => Promise<[unknown, { message: string } | null]>,
    successMessage = t("actionDone"),
  ) {
    setActionId(applicationId);
    startTransition(() => {
      void (async () => {
        const [result, error] = await action();
        setActionId("");
        if (error) {
          toast.error(error.message);
          return;
        }
        const hireResult = result as {
          teachingAssignment?: {
            assigned: number;
            classNames: string[];
            reason: string | null;
          };
        } | null;
        const assignment = hireResult?.teachingAssignment;
        if (assignment && assignment.assigned > 0) {
          toast.success(
            t("hireSuccessAssigned", {
              classes: assignment.classNames.join(", "),
              count: assignment.assigned,
            }),
          );
        } else if (assignment?.reason) {
          toast.success(
            t("hireSuccessNoAssign", { reason: assignment.reason }),
          );
        } else {
          toast.success(successMessage);
        }
        await loadApplications({ soft: true });
        if (detail?.id === applicationId) {
          const [updated] = await getJobApplicationDetailAction({
            applicationId,
          });
          setDetail(updated);
        }
      })();
    });
  }

  async function handleExportListPdf() {
    setExportingPdf(true);
    try {
      const [context, error] = await getJobApplicationReportContextAction();
      if (error || !context) {
        toast.error(error?.message ?? t("pdfPrepareFailed"));
        return;
      }
      await exportCandidaturesReportPdf(filteredApplications, context, pdfLabels, {
        status: statusFilter,
      });
      toast.success(t("reportPdfSuccess"));
    } catch {
      toast.error(t("reportPdfFailed"));
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportDossierPdf() {
    if (!detail) return;
    setExportingDossier(true);
    try {
      const [context, error] = await getJobApplicationReportContextAction();
      if (error || !context) {
        toast.error(error?.message ?? t("pdfPrepareFailed"));
        return;
      }
      await downloadCandidatureDossierPdf(detail, context, pdfLabels);
      toast.success(t("dossierPdfSuccess"));
    } catch {
      toast.error(t("dossierPdfFailed"));
    } finally {
      setExportingDossier(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STATUS_CARD_VALUES.map((status) => {
          const tone = statusTone(status);
          const Icon = tone.icon;
          const active = statusFilter === status;
          const label = t(`statusCard.${status}`);
          return (
            <button
              key={status}
              type="button"
              onClick={() =>
                setStatusFilter((current) =>
                  current === status ? "ALL" : status,
                )
              }
              className={cn(
                "rounded-xl border border-l-4 bg-card px-4 py-3 text-left transition-colors",
                tone.card,
                active
                  ? "ring-2 ring-primary/30"
                  : "hover:bg-accent/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {label}
                </p>
                <Icon className="size-3.5 text-muted-foreground" />
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                {counts[status]}
              </p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="size-5" />
            {t("listTitle")}
            <Badge variant="outline">{filteredApplications.length}</Badge>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              loading || exportingPdf || filteredApplications.length === 0
            }
            onClick={() => void handleExportListPdf()}
          >
            {exportingPdf ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 size-4" />
            )}
            {t("reportPdf")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                variant={statusFilter === filter.value ? "default" : "outline"}
                className="h-8"
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
                <span className="ml-1.5 text-[10px] opacity-70">
                  {counts[filter.value]}
                </span>
              </Button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : filteredApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptyFilter")}</p>
          ) : (
            <div className="grid gap-3">
              {filteredApplications.map((application) => {
                const tone = statusTone(application.status);
                return (
                  <div
                    key={application.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border border-l-4 bg-background p-4 lg:flex-row lg:items-center lg:justify-between",
                      tone.card,
                    )}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {application.prenom} {application.nom}{" "}
                          {application.postnom}
                        </p>
                        <StatusBadge
                          status={application.status}
                          label={statusLabel(application.status)}
                        />
                        <Badge variant="outline">
                          {application.applicationType === "TEACHER"
                            ? t("applicationType.TEACHER")
                            : t("applicationType.STAFF")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {application.reference} · {application.email} ·{" "}
                        {new Date(application.createdAt).toLocaleDateString(
                          locale,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {application.applicationType === "TEACHER"
                          ? `${application.desiredSubjects || "-"} · ${application.desiredLevels || "-"}`
                          : orgRoleLabel(application.desiredOrgRole || "-")}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actionId === application.id || isPending}
                        onClick={() => openDetail(application.id)}
                      >
                        <Eye className="mr-2 size-4" />
                        {t("details")}
                      </Button>

                      {application.status === "PENDING" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionId === application.id || isPending}
                          onClick={() =>
                            runAction(application.id, () =>
                              reviewJobApplicationAction({
                                applicationId: application.id,
                              }),
                            )
                          }
                        >
                          <Clock3 className="mr-2 size-4" />
                          {t("review")}
                        </Button>
                      ) : null}

                      {["PENDING", "REVIEWED"].includes(application.status) ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={actionId === application.id || isPending}
                          onClick={() =>
                            runAction(
                              application.id,
                              () =>
                                acceptJobApplicationAction({
                                  applicationId: application.id,
                                }),
                              t("accepted"),
                            )
                          }
                        >
                          <CheckCircle2 className="mr-2 size-4" />
                          {t("accept")}
                        </Button>
                      ) : null}

                      {application.status === "ACCEPTED" ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={actionId === application.id || isPending}
                          onClick={() =>
                            runAction(application.id, () =>
                              hireJobApplicationAction({
                                applicationId: application.id,
                              }),
                            )
                          }
                        >
                          <UserCheck className="mr-2 size-4" />
                          {t("hire")}
                        </Button>
                      ) : null}

                      {["PENDING", "REVIEWED", "ACCEPTED"].includes(
                        application.status,
                      ) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={actionId === application.id || isPending}
                          onClick={() => {
                            setRejectTargetId(application.id);
                            setRejectReason("");
                            setRejectOpen(true);
                          }}
                        >
                          <XCircle className="mr-2 size-4" />
                          {t("reject")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent
          size="lg"
          className="flex max-h-[min(92dvh,42rem)] w-[min(calc(100vw-1rem),36rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[min(calc(100vw-2rem),40rem)]"
        >
          <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-3 text-left sm:px-5">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {t("dossierTitle")}
              {detail ? (
                <StatusBadge
                  status={detail.status}
                  label={statusLabel(detail.status)}
                />
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {detail
                ? t("dossierDeposited", {
                    reference: detail.reference,
                    date: new Date(detail.createdAt).toLocaleDateString(locale),
                  })
                : t("dossierLoading")}
            </DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
              {detail.photoUrl ? (
                <div className="overflow-hidden rounded-xl border bg-muted/20 shadow-inner">
                  <Image
                    width={100}
                    height={100}
                    src={detail.photoUrl}
                    alt={`${detail.prenom} ${detail.nom}`}
                    className="mx-auto max-h-[min(28dvh,12rem)] w-full object-contain"
                  />
                </div>
              ) : null}

              {detail.status === "REJECTED" && detail.rejectedReason ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {t("rejectReasonTitle")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {detail.rejectedReason}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                {[
                  {
                    label: tCommon("person.lastName"),
                    value: `${detail.prenom} ${detail.nom} ${detail.postnom}`.trim(),
                  },
                  { label: tCommon("person.email"), value: detail.email },
                  { label: t("fields.phone"), value: detail.telephone },
                  {
                    label: t("fields.type"),
                    value:
                      detail.applicationType === "TEACHER"
                        ? t("applicationType.TEACHER")
                        : t("applicationType.STAFF"),
                  },
                  detail.desiredOrgRole
                    ? {
                        label: t("fields.desiredRole"),
                        value: orgRoleLabel(detail.desiredOrgRole),
                      }
                    : null,
                  detail.desiredSubjects
                    ? { label: t("fields.subjects"), value: detail.desiredSubjects }
                    : null,
                  detail.desiredLevels
                    ? { label: t("fields.levels"), value: detail.desiredLevels }
                    : null,
                  detail.availability
                    ? {
                        label: t("fields.availability"),
                        value: detail.availability,
                      }
                    : null,
                ]
                  .filter(Boolean)
                  .map((item) => (
                    <div key={item!.label} className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {item!.label}
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold leading-snug">
                        {item!.value}
                      </p>
                    </div>
                  ))}
              </div>

              {(
                [
                  [t("fields.experience"), detail.experienceSummary],
                  [t("fields.education"), detail.educationSummary],
                  [t("fields.skills"), detail.skills],
                  [t("fields.motivation"), detail.motivation],
                ] as const
              )
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border bg-muted/10 px-4 py-3"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                      {value}
                    </p>
                  </div>
                ))}
            </div>
          ) : null}

          <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:space-x-0 sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!detail || exportingDossier}
              onClick={() => void handleExportDossierPdf()}
            >
              {exportingDossier ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              {t("dossierPdf")}
            </Button>
            {detail?.cvUrl ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setDocViewer("cv")}
              >
                <Eye className="mr-2 size-4" />
                {t("readCv")}
              </Button>
            ) : null}
            {detail?.coverLetterUrl ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setDocViewer("coverLetter")}
              >
                <Eye className="mr-2 size-4" />
                {t("readCoverLetter")}
              </Button>
            ) : null}
            {detail?.cvUrl ? (
              <Button asChild variant="ghost" className="w-full sm:w-auto">
                <a
                  href={detail.cvUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="mr-2 size-4" />
                  {t("cv")}
                </a>
              </Button>
            ) : null}
            {detail?.coverLetterUrl ? (
              <Button asChild variant="ghost" className="w-full sm:w-auto">
                <a
                  href={detail.coverLetterUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="mr-2 size-4" />
                  {t("coverLetter")}
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setDetailOpen(false)}
            >
              {tCommon("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent
          size="lg"
          className="flex max-h-[min(92dvh,28rem)] w-[min(calc(100vw-1rem),36rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[min(calc(100vw-2rem),40rem)]"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 text-left sm:px-5">
            <DialogTitle>{t("rejectDialogTitle")}</DialogTitle>
            <DialogDescription>{t("rejectDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-3 sm:px-5">
            <Label htmlFor="reject-reason">{t("reason")}</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={t("rejectPlaceholder")}
            />
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:space-x-0 sm:px-5">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setRejectOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={!rejectReason.trim() || isPending}
              onClick={() => {
                runAction(
                  rejectTargetId,
                  () =>
                    rejectJobApplicationAction({
                      applicationId: rejectTargetId,
                      reason: rejectReason.trim(),
                    }),
                  t("rejected"),
                );
                setRejectOpen(false);
              }}
            >
              {t("confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detail?.cvUrl && docViewer === "cv" ? (
        <DocumentReadViewer
          open
          onOpenChange={(open) => {
            if (!open) setDocViewer(null);
          }}
          title={t("cv")}
          fileUrl={detail.cvUrl}
        />
      ) : null}
      {detail?.coverLetterUrl && docViewer === "coverLetter" ? (
        <DocumentReadViewer
          open
          onOpenChange={(open) => {
            if (!open) setDocViewer(null);
          }}
          title={t("coverLetterFull")}
          fileUrl={detail.coverLetterUrl}
        />
      ) : null}
    </div>
  );
}
