"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useParams, usePathname } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Bell,
  UserPlus,
  Briefcase,
  RefreshCw,
  Clock,
  AlertCircle,
  Eye,
  XCircle,
  ClipboardList,
  Undo2,
  Banknote,
  FilePenLine,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { readClientSearchParam } from "@/lib/client-search-params";
import {
  dispatchCandidaturePrefill,
  dispatchRegistrationPrefill,
} from "@/lib/prefill-events";
import { NOTIFICATIONS_REFRESH_EVENT, openMessagingDrawer, refreshMessagingBell } from "@/lib/notification-events";
import {
  confirmNotificationRequestAction,
  getNotificationCountAction,
  getNotificationRequestsAction,
  rejectNotificationRequestAction,
} from "@/lib/actions/notification.actions";
import { reviewJobApplicationAction } from "@/app/components/depot-candidature/job-application.actions";
import {
  getAbsenceInboxAction,
  markAbsenceNotificationReadAction,
} from "@/lib/actions/absence.actions";
import {
  AbsenceCaseDialog,
  type AbsenceCaseDialogData,
} from "@/components/absence-case-dialog";
import { GradeModificationReviewDialog, GradeModificationDecisionDialog } from "@/components/fiche-scores-dialog";

type RegistrationRow = {
  id: string;
  reference: string;
  status: string;
  studentData: {
    name?: string;
    postnom?: string;
    prenom?: string;
  } | null;
  requestedLevel: string | null;
  requestedOption: string | null;
  photoUrl: string | null;
  createdAt: Date | string;
  kind: "registration";
};

type JobRow = {
  id: string;
  reference: string;
  status: string;
  applicationType: string;
  nom: string;
  postnom: string;
  prenom: string;
  photoUrl: string | null;
  desiredOrgRole: string | null;
  desiredSubjects: string | null;
  createdAt: Date | string;
  kind: "job";
};

type AbsenceRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: Date | string;
  kind: "absence";
  case: AbsenceCaseDialogData | null;
  gradeModificationRequestId?: string | null;
  conversationId?: string | null;
  href?: string | null;
};

type NotificationItem = RegistrationRow | JobRow | AbsenceRow;

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span
        aria-label={`${count} notification${count > 1 ? "s" : ""}`}
        className={cn(
          "relative inline-flex h-4 min-w-4 items-center justify-center",
          "rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white",
          "ring-2 ring-background",
        )}
      >
        {count > 99 ? "99+" : count}
      </span>
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

function PersonAvatar({
  photoUrl,
  name,
  fallback,
}: {
  photoUrl: string | null;
  name: string;
  fallback: React.ReactNode;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={36}
        height={36}
        unoptimized
        className="size-9 shrink-0 rounded-full object-cover ring-2 ring-primary/10"
      />
    );
  }
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
      {initials || fallback}
    </div>
  );
}

function NotificationRow({
  item,
  onView,
  onReject,
  busyId,
}: {
  item: RegistrationRow | JobRow;
  onView: (item: RegistrationRow | JobRow) => void;
  onReject: (item: RegistrationRow) => void;
  busyId: string | null;
}) {
  const fullName =
    item.kind === "registration"
      ? [item.studentData?.name, item.studentData?.postnom, item.studentData?.prenom]
          .filter(Boolean)
          .join(" ") || "Élève inconnu"
      : [item.nom, item.postnom, item.prenom].filter(Boolean).join(" ") ||
        "Candidat inconnu";

  const subtitle =
    item.kind === "registration"
      ? [item.requestedLevel, item.requestedOption].filter(Boolean).join(" · ")
      : item.applicationType === "TEACHER"
        ? `Enseignant · ${item.desiredSubjects || "—"}`
        : `Personnel · ${item.desiredOrgRole || "—"}`;

  const createdAt =
    item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);

  const isBusy = busyId === item.id;
  const statusLabel =
    item.kind === "job" && item.status === "REVIEWED"
      ? "Examination en cours…"
      : item.status === "CONFIRMED"
        ? "En cours"
        : "En attente";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-0",
        "transition-colors hover:bg-accent/50",
      )}
    >
      <PersonAvatar
        photoUrl={item.photoUrl}
        name={fullName}
        fallback={
          item.kind === "registration" ? (
            <UserPlus className="size-4" />
          ) : (
            <Briefcase className="size-4" />
          )
        }
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">
          {fullName}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {item.kind === "registration" ? "Inscription" : "Candidature"} ·{" "}
          {item.reference}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <Clock className="size-3" />
          {formatDistanceToNow(createdAt, { addSuffix: true, locale: fr })}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Badge
          variant="outline"
          className="h-5 border-amber-400/60 bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
        >
          {statusLabel}
        </Badge>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-[10px] text-primary hover:bg-primary/10 hover:text-primary"
          onClick={() => onView(item)}
          disabled={isBusy}
          title="Voir la demande"
        >
          {isBusy ? (
            <RefreshCw className="size-3 animate-spin" />
          ) : (
            <Eye className="size-3" />
          )}
          Voir la demande
        </Button>

        {item.kind === "registration" ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onReject(item)}
            disabled={isBusy}
            title="Rejeter"
          >
            <XCircle className="size-3" />
            Rejeter
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AbsenceNotificationRow({
  item,
  onOpen,
  onReply,
}: {
  item: AbsenceRow;
  onOpen: (item: AbsenceRow) => void;
  onReply?: (item: AbsenceRow) => void;
}) {
  const createdAt =
    item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
  const isPayment = item.type === "PAYMENT";
  const canReplyDirect =
    Boolean(onReply) &&
    (item.type === "JUSTIFICATION_SUBMITTED" ||
      item.type === "JUSTIFICATION_DECISION" ||
      item.type === "ABSENCE") &&
    Boolean(item.case?.id);
  const actionLabel = isPayment
    ? "Vu"
    : item.type === "ABSENCE"
        ? "Justifier"
        : item.type === "JUSTIFICATION_SUBMITTED" ||
            item.type === "GRADE_MODIFICATION_SUBMITTED"
          ? "Examiner"
          : item.type === "GRADE_MODIFICATION_DECISION"
            ? "OK"
            : "Voir";

  return (
    <div className="group flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-0 transition-colors hover:bg-accent/50">
      <div
        className={
          isPayment
            ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"
            : item.type.startsWith("GRADE_MODIFICATION")
              ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600"
              : "flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600"
        }
      >
        {isPayment ? (
          <Banknote className="size-4" />
        ) : item.type.startsWith("GRADE_MODIFICATION") ? (
          <FilePenLine className="size-4" />
        ) : item.type === "RETURN" ? (
          <Undo2 className="size-4" />
        ) : (
          <ClipboardList className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">
          {item.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {item.body}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <Clock className="size-3" />
          {formatDistanceToNow(createdAt, { addSuffix: true, locale: fr })}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-[10px] text-primary hover:bg-primary/10"
          onClick={() => onOpen(item)}
        >
          <Eye className="size-3" />
          {actionLabel}
        </Button>
        {canReplyDirect ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[10px] text-primary hover:bg-primary/10"
            onClick={() => onReply?.(item)}
          >
            Répondre
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationBell() {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const hasLoadedRef = useRef(false);
  const lastMessagingCountRef = useRef<number | null>(null);
  const [absenceDialog, setAbsenceDialog] = useState<{
    mode: "justify" | "review" | "view";
    caseRow: AbsenceCaseDialogData;
  } | null>(null);
  const [gradeDialogRequestId, setGradeDialogRequestId] = useState<
    string | null
  >(null);
  const [gradeDecisionRequestId, setGradeDecisionRequestId] = useState<
    string | null
  >(null);

  const branchBase =
    params.organizationId && params.branchId
      ? `/admin/organizations/${params.organizationId}/branches/${params.branchId}`
      : "";

  const loadCount = useCallback(async () => {
    if (!params.branchId) {
      setPendingCount(0);
      return;
    }
    try {
      const [data] = await getNotificationCountAction();
      if (typeof data?.count === "number") {
        setPendingCount(data.count);
      }
      const messagingCount = data?.messagingCount;
      if (typeof messagingCount === "number") {
        const previous = lastMessagingCountRef.current;
        if (previous !== null && messagingCount > previous) {
          refreshMessagingBell();
        }
        lastMessagingCountRef.current = messagingCount;
      }
    } catch {
      // Conserver le dernier compteur connu.
    }
  }, [params.branchId]);

  const loadRequests = useCallback(async () => {
    if (!params.branchId) {
      setItems([]);
      hasLoadedRef.current = false;
      return;
    }
    const isInitial = !hasLoadedRef.current;
    setError(null);
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    try {
      const [absenceResult, legacyResult] = await Promise.all([
        getAbsenceInboxAction(),
        getNotificationRequestsAction(),
      ]);
      const [absenceData] = absenceResult;
      const [legacyData] = legacyResult;

      const absenceItems: AbsenceRow[] = (absenceData?.notifications ?? [])
        .filter((row) => row.type !== "MESSAGE")
        .map(
        (row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          body: row.body,
          createdAt: row.createdAt,
          kind: "absence" as const,
          case: row.case,
          gradeModificationRequestId: row.gradeModificationRequestId,
          conversationId: row.conversationId,
          href: row.href,
        }),
      );

      const registrationItems: RegistrationRow[] = (
        legacyData?.registrations ?? []
      )
        .filter(
          (row) => row.status === "PENDING" || row.status === "CONFIRMED",
        )
        .map((row) => ({
          ...row,
          studentData:
            row.studentData && typeof row.studentData === "object"
              ? (row.studentData as RegistrationRow["studentData"])
              : null,
          kind: "registration" as const,
        }));

      const jobItems: JobRow[] = (legacyData?.jobApplications ?? [])
        .filter((row) => ["PENDING", "REVIEWED"].includes(row.status))
        .map((row) => ({ ...row, kind: "job" as const }));

      const merged = [...absenceItems, ...registrationItems, ...jobItems].sort(
        (a, b) => {
          const left = new Date(a.createdAt).getTime();
          const right = new Date(b.createdAt).getTime();
          return right - left;
        },
      );
      setItems(merged.slice(0, 40));
      hasLoadedRef.current = true;
      await loadCount();
    } catch {
      if (isInitial) setError("Erreur inattendue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.branchId, loadCount]);

  useEffect(() => {
    hasLoadedRef.current = false;
    setItems([]);
  }, [params.branchId]);

  useEffect(() => {
    void loadCount();
  }, [loadCount, pathname]);

  useEffect(() => {
    if (open) void loadRequests();
  }, [open, loadRequests]);

  useEffect(() => {
    function onRefresh() {
      void loadCount();
    }
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    function onVisible() {
      if (document.visibilityState === "visible") onRefresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadCount]);

  useEffect(() => {
    if (!params.branchId) return;
    const interval = window.setInterval(() => {
      void loadCount();
      if (open) void loadRequests();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [open, params.branchId, loadCount, loadRequests]);

  const openRegistration = useCallback(
    (requestId: string) => {
      if (!branchBase) return;
      setOpen(false);
      const targetPath = `${branchBase}/registration`;
      const url = `${targetPath}?requestId=${requestId}`;
      const onPage = pathname.includes("/registration");
      const currentId = readClientSearchParam("requestId");

      if (onPage) {
        if (currentId === requestId) {
          dispatchRegistrationPrefill(requestId);
        } else {
          router.replace(url);
        }
        return;
      }
      router.push(url);
    },
    [branchBase, pathname, router],
  );

  const openCandidature = useCallback(
    (applicationId: string) => {
      if (!branchBase) return;
      setOpen(false);
      const targetPath = `${branchBase}/candidatures`;
      const url = `${targetPath}?applicationId=${applicationId}`;
      const onPage = pathname.includes("/candidatures");
      const currentId = readClientSearchParam("applicationId");

      if (onPage) {
        if (currentId === applicationId) {
          dispatchCandidaturePrefill(applicationId);
        } else {
          router.replace(url);
        }
        return;
      }
      router.push(url);
    },
    [branchBase, pathname, router],
  );

  const handleView = useCallback(
    (item: RegistrationRow | JobRow) => {
      setBusyId(item.id);
      startTransition(async () => {
        try {
          if (item.kind === "registration") {
            if (item.status === "PENDING") {
              const [, err] = await confirmNotificationRequestAction({
                requestId: item.id,
              });
              if (err) return;
              void loadCount();
            }
            openRegistration(item.id);
            return;
          }

          if (item.status === "PENDING") {
            const [, err] = await reviewJobApplicationAction({
              applicationId: item.id,
            });
            if (err) return;
            void loadCount();
          }
          openCandidature(item.id);
        } finally {
          setBusyId(null);
        }
      });
    },
    [loadCount, openCandidature, openRegistration],
  );

  const handleReject = useCallback(
    (item: RegistrationRow) => {
      setBusyId(item.id);
      startTransition(async () => {
        try {
          const [, err] = await rejectNotificationRequestAction({
            requestId: item.id,
          });
          if (err) return;
          setItems((current) =>
            current.filter(
              (row) => !(row.kind === "registration" && row.id === item.id),
            ),
          );
          void loadCount();
        } finally {
          setBusyId(null);
        }
      });
    },
    [loadCount],
  );

  if (!params.branchId) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes eteyelo-bell-ring {
          0%,
          45%,
          100% {
            transform: rotate(0deg);
          }
          5%,
          15%,
          25%,
          35% {
            transform: rotate(13deg);
          }
          10%,
          20%,
          30%,
          40% {
            transform: rotate(-13deg);
          }
        }
        .eteyelo-bell-active {
          animation: eteyelo-bell-ring 2.4s ease-in-out infinite;
          transform-origin: 50% 15%;
        }
        @media (prefers-reduced-motion: reduce) {
          .eteyelo-bell-active {
            animation: none;
          }
        }
      `}</style>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative size-9 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={
              pendingCount > 0
                ? `${pendingCount} notification${pendingCount > 1 ? "s" : ""} en attente`
                : "Notifications"
            }
          >
            <Bell
              className={cn(
                "size-4",
                pendingCount > 0 && "eteyelo-bell-active text-red-500",
              )}
            />
            <CountBadge count={pendingCount} />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[380px] max-w-[calc(100vw-1rem)] p-0 shadow-xl"
        >
          <div className="flex items-center justify-between border-b bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <span className="text-sm font-bold text-foreground">
                Notifications
              </span>
              {pendingCount > 0 ? (
                <Badge className="h-5 px-1.5 text-[10px] font-bold">
                  {pendingCount}
                </Badge>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-full p-0 text-muted-foreground hover:text-foreground"
              onClick={() => void loadRequests()}
              disabled={loading || refreshing}
              title="Actualiser"
            >
              <RefreshCw
                className={cn(
                  "size-3.5",
                  (loading || refreshing) && "animate-spin",
                )}
              />
            </Button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="divide-y divide-border/50">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : error && items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <AlertCircle className="size-8 text-destructive/60" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void loadRequests()}
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Réessayer
                </Button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Bell className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Tout est à jour
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aucune notification pour le moment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {items.map((item) =>
                  item.kind === "absence" ? (
                    <AbsenceNotificationRow
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      onOpen={(row) => {
                        if (row.type === "PAYMENT") {
                          void markAbsenceNotificationReadAction({
                            notificationId: row.id,
                          }).then(() => void loadRequests());
                          return;
                        }
                        if (row.type === "GRADE_MODIFICATION_SUBMITTED") {
                          if (row.gradeModificationRequestId) {
                            setGradeDialogRequestId(
                              row.gradeModificationRequestId,
                            );
                          }
                          void markAbsenceNotificationReadAction({
                            notificationId: row.id,
                          }).then(() => void loadRequests());
                          setOpen(false);
                          return;
                        }
                        if (row.type === "GRADE_MODIFICATION_DECISION") {
                          if (row.gradeModificationRequestId) {
                            setGradeDecisionRequestId(
                              row.gradeModificationRequestId,
                            );
                          }
                          void markAbsenceNotificationReadAction({
                            notificationId: row.id,
                          }).then(() => void loadRequests());
                          setOpen(false);
                          return;
                        }
                        if (!row.case) return;
                        const mode =
                          row.type === "ABSENCE" &&
                          (row.case.status === "OPEN" ||
                            row.case.status === "REJECTED")
                            ? "justify"
                            : row.type === "JUSTIFICATION_SUBMITTED" &&
                                row.case.status === "PENDING_REVIEW"
                              ? "review"
                              : "view";
                        setAbsenceDialog({ mode, caseRow: row.case });
                        setOpen(false);
                      }}
                      onReply={(row) => {
                        if (!row.case || !params.organizationId) return;
                        void markAbsenceNotificationReadAction({
                          notificationId: row.id,
                        });
                        openMessagingDrawer({
                          contextType: "ABSENCE_CASE",
                          contextId: row.case.id,
                        });
                        setOpen(false);
                      }}
                    />
                  ) : (
                    <NotificationRow
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      onView={handleView}
                      onReject={handleReject}
                      busyId={busyId}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <AbsenceCaseDialog
        open={Boolean(absenceDialog)}
        onOpenChange={(next) => {
          if (!next) setAbsenceDialog(null);
        }}
        mode={absenceDialog?.mode ?? "view"}
        caseRow={absenceDialog?.caseRow ?? null}
        onDone={() => void loadRequests()}
      />
      <GradeModificationReviewDialog
        open={Boolean(gradeDialogRequestId)}
        onOpenChange={(next) => {
          if (!next) setGradeDialogRequestId(null);
        }}
        requestId={gradeDialogRequestId}
        onDone={() => void loadRequests()}
      />
      <GradeModificationDecisionDialog
        open={Boolean(gradeDecisionRequestId)}
        onOpenChange={(next) => {
          if (!next) setGradeDecisionRequestId(null);
        }}
        requestId={gradeDecisionRequestId}
        onDone={() => {
          setGradeDecisionRequestId(null);
          router.refresh();
        }}
      />
    </>
  );
}
