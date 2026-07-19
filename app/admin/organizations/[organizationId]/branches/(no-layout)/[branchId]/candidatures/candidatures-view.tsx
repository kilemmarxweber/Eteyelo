"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useSearchParams } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

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
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  CANDIDATURE_PREFILL_EVENT,
  type PrefillEventDetail,
} from "@/lib/prefill-events";
import type { JobApplicationListItem } from "@/src/interfaces/JobApplication";
import {
  acceptJobApplicationAction,
  getJobApplicationDetailAction,
  getJobApplicationsAction,
  hireJobApplicationAction,
  rejectJobApplicationAction,
  reviewJobApplicationAction,
} from "@/app/components/depot-candidature/job-application.actions";
import Image from "next/image";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  REVIEWED: "Examinée",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  HIRED: "Embauchée",
  CANCELLED: "Annulée",
};

function statusVariant(status: string) {
  if (status === "ACCEPTED" || status === "HIRED") return "default";
  if (status === "REJECTED") return "destructive";
  return "secondary";
}

export function CandidaturesView() {
  const searchParams = useSearchParams();
  const requestedApplicationId = searchParams.get("applicationId") ?? "";
  const [applications, setApplications] = useState<JobApplicationListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  const loadApplications = useCallback(async () => {
    setLoading(true);
    const [data, error] = await getJobApplicationsAction();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setApplications((data ?? []) as JobApplicationListItem[]);
    setLoading(false);
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
    successMessage = "Action effectuée.",
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
            `Embauche OK — affecté à ${assignment.classNames.join(", ")} (${assignment.assigned} cours).`,
          );
        } else if (assignment?.reason) {
          toast.success(`Embauche OK. Affectation non faite : ${assignment.reason}.`);
        } else {
          toast.success(successMessage);
        }
        await loadApplications();
        if (detail?.id === applicationId) {
          const [updated] = await getJobApplicationDetailAction({
            applicationId,
          });
          setDetail(updated);
        }
      })();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="size-5" />
            Candidatures reçues
            <Badge variant="outline">{applications.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune candidature pour le moment.
            </p>
          ) : (
            <div className="grid gap-3">
              {applications.map((application) => (
                <div
                  key={application.id}
                  className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {application.prenom} {application.nom}{" "}
                        {application.postnom}
                      </p>
                      <Badge variant={statusVariant(application.status)}>
                        {STATUS_LABEL[application.status] ?? application.status}
                      </Badge>
                      <Badge variant="outline">
                        {application.applicationType === "TEACHER"
                          ? "Enseignant"
                          : "Personnel"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {application.reference} · {application.email} ·{" "}
                      {new Date(application.createdAt).toLocaleDateString(
                        "fr-FR",
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
                      Détails
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
                        Examiner
                      </Button>
                    ) : null}

                    {["PENDING", "REVIEWED"].includes(application.status) ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={actionId === application.id || isPending}
                        onClick={() =>
                          runAction(application.id, () =>
                            acceptJobApplicationAction({
                              applicationId: application.id,
                            }),
                          )
                        }
                      >
                        <CheckCircle2 className="mr-2 size-4" />
                        Accepter
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
                        Embaucher
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
                        Refuser
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent
          size="lg"
          className="flex max-h-[min(92dvh,42rem)] w-[min(calc(100vw-1rem),36rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[min(calc(100vw-2rem),40rem)]"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 text-left sm:px-5">
            <DialogTitle>Dossier candidature</DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.reference} · ${STATUS_LABEL[detail.status] ?? detail.status}`
                : "Chargement du dossier…"}
            </DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
              {detail.photoUrl ? (
                <div className="overflow-hidden rounded-xl border bg-muted/20 shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <Image
                    width={100}
                    height={100}
                    src={detail.photoUrl}
                    alt={`${detail.prenom} ${detail.nom}`}
                    className="mx-auto max-h-[min(28dvh,12rem)] w-full object-contain"
                  />
                </div>
              ) : null}

              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                {[
                  {
                    label: "Nom",
                    value: `${detail.prenom} ${detail.nom} ${detail.postnom}`.trim(),
                  },
                  { label: "Email", value: detail.email },
                  { label: "Téléphone", value: detail.telephone },
                  {
                    label: "Type",
                    value:
                      detail.applicationType === "TEACHER"
                        ? "Enseignant"
                        : "Personnel",
                  },
                  detail.desiredOrgRole
                    ? {
                        label: "Rôle souhaité",
                        value: orgRoleLabel(detail.desiredOrgRole),
                      }
                    : null,
                  detail.desiredSubjects
                    ? { label: "Matières", value: detail.desiredSubjects }
                    : null,
                  detail.desiredLevels
                    ? { label: "Niveaux", value: detail.desiredLevels }
                    : null,
                  detail.availability
                    ? { label: "Disponibilité", value: detail.availability }
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
                  ["Expérience", detail.experienceSummary],
                  ["Formation", detail.educationSummary],
                  ["Compétences", detail.skills],
                  ["Motivation", detail.motivation],
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
            {detail?.cvUrl ? (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a href={detail.cvUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 size-4" />
                  CV
                </a>
              </Button>
            ) : null}
            {detail?.coverLetterUrl ? (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a
                  href={detail.coverLetterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="mr-2 size-4" />
                  Lettre
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setDetailOpen(false)}
            >
              Fermer
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
            <DialogTitle>Refuser la candidature</DialogTitle>
            <DialogDescription>
              Indiquez un motif clair pour le candidat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-3 sm:px-5">
            <Label htmlFor="reject-reason">Motif</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Expliquez brièvement le refus"
            />
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:space-x-0 sm:px-5">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setRejectOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={!rejectReason.trim() || isPending}
              onClick={() => {
                runAction(rejectTargetId, () =>
                  rejectJobApplicationAction({
                    applicationId: rejectTargetId,
                    reason: rejectReason.trim(),
                  }),
                );
                setRejectOpen(false);
              }}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
