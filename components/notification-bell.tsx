"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { useParams, usePathname } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Bell,
  UserPlus,
  Briefcase,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  FileInput,
} from "lucide-react";
import { toast } from "sonner";
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
import { authClient } from "@/lib/auth-client";
import {
  canSeeBranchNotifications,
  canSeeCandidatureNotifications,
  canSeeInscriptionNotifications,
} from "@/lib/auth/session-roles";
import {
  confirmNotificationRequestAction,
  getNotificationRequestsAction,
} from "@/lib/actions/notification.actions";
import { acceptJobApplicationAction } from "@/app/components/depot-candidature/job-application.actions";

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

type NotificationItem = RegistrationRow | JobRow;

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
  onConfirm,
  onPrefill,
  confirming,
}: {
  item: NotificationItem;
  onConfirm: (item: NotificationItem) => void;
  onPrefill: (item: NotificationItem) => void;
  confirming: string | null;
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

  const isPending =
    item.kind === "registration"
      ? item.status === "PENDING"
      : item.status === "PENDING" || item.status === "REVIEWED";
  const isReady =
    item.kind === "registration"
      ? item.status === "CONFIRMED"
      : item.status === "ACCEPTED";

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
        {isPending ? (
          <Badge
            variant="outline"
            className="h-5 border-amber-400/60 bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
          >
            En attente
          </Badge>
        ) : null}
        {isReady ? (
          <Badge
            variant="outline"
            className="h-5 border-blue-400/60 bg-blue-50 px-1.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
          >
            Confirmé
          </Badge>
        ) : null}

        {isPending ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[10px] text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => onConfirm(item)}
            disabled={confirming === item.id}
            title={
              item.kind === "registration"
                ? "Examiner la demande"
                : "Voir la demande"
            }
          >
            {confirming === item.id ? (
              <RefreshCw className="size-3 animate-spin" />
            ) : (
              <CheckCircle className="size-3" />
            )}
            {item.kind === "registration"
              ? "Examiner la demande"
              : "Voir la demande"}
          </Button>
        ) : null}

        {isReady ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[10px] text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => onPrefill(item)}
            title="Pré-remplir"
          >
            <FileInput className="size-3" />
            Pré-remplir
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
  const { data: session } = authClient.useSession();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const canSeeInscriptions = canSeeInscriptionNotifications(session);
  const canSeeCandidatures = canSeeCandidatureNotifications(session);
  const canSeeNotifications = canSeeBranchNotifications(session);

  const pendingCount = items.filter((item) =>
    item.kind === "registration"
      ? item.status === "PENDING"
      : item.status === "PENDING" || item.status === "REVIEWED",
  ).length;

  const branchBase = params.organizationId && params.branchId
    ? `/admin/organizations/${params.organizationId}/branches/${params.branchId}`
    : "";

  const loadRequests = useCallback(async () => {
    if (!canSeeNotifications) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [data, err] = await getNotificationRequestsAction();
      if (err || !data) {
        setError("Impossible de charger les notifications.");
        return;
      }
      const registrationItems: RegistrationRow[] = canSeeInscriptions
        ? (data.registrations ?? [])
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
            }))
        : [];

      const jobItems: JobRow[] = canSeeCandidatures
        ? (data.jobApplications ?? [])
            .filter((row) =>
              ["PENDING", "REVIEWED", "ACCEPTED"].includes(row.status),
            )
            .map((row) => ({ ...row, kind: "job" as const }))
        : [];

      const merged = [...registrationItems, ...jobItems].sort((a, b) => {
        const left = new Date(a.createdAt).getTime();
        const right = new Date(b.createdAt).getTime();
        return right - left;
      });
      setItems(merged.slice(0, 30));
    } catch {
      setError("Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }, [canSeeCandidatures, canSeeInscriptions, canSeeNotifications]);

  useEffect(() => {
    if (open) void loadRequests();
  }, [open, loadRequests]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!params.branchId || !canSeeNotifications) return;
    const interval = setInterval(() => {
      if (!open) void loadRequests();
    }, 15_000);
    return () => clearInterval(interval);
  }, [open, params.branchId, loadRequests, canSeeNotifications]);

  const handleConfirm = useCallback(
    (item: NotificationItem) => {
      setConfirming(item.id);
      startTransition(async () => {
        try {
          if (item.kind === "registration") {
            const [, err] = await confirmNotificationRequestAction({
              requestId: item.id,
            });
            if (err) {
              toast.error(err.message ?? "Erreur lors de la confirmation.");
              return;
            }
            toast.success("Demande d'inscription examinée.");
          } else {
            const [, err] = await acceptJobApplicationAction({
              applicationId: item.id,
            });
            if (err) {
              toast.error(err.message ?? "Erreur lors de la confirmation.");
              return;
            }
            toast.success("Candidature ouverte — vous pouvez la pré-remplir.");
          }
          void loadRequests();
        } catch {
          toast.error("Erreur inattendue.");
        } finally {
          setConfirming(null);
        }
      });
    },
    [loadRequests],
  );

  const handlePrefill = useCallback(
    (item: NotificationItem) => {
      setOpen(false);
      if (!branchBase) return;

      if (item.kind === "registration") {
        const targetPath = `${branchBase}/registration`;
        const url = `${targetPath}?requestId=${item.id}`;
        const onPage = pathname.includes("/registration");
        const currentId = readClientSearchParam("requestId");

        if (onPage) {
          if (currentId === item.id) {
            dispatchRegistrationPrefill(item.id);
          } else {
            router.replace(url);
          }
          return;
        }
        router.push(url);
        return;
      }

      const targetPath = `${branchBase}/candidatures`;
      const url = `${targetPath}?applicationId=${item.id}`;
      const onPage = pathname.includes("/candidatures");
      const currentId = readClientSearchParam("applicationId");

      if (onPage) {
        if (currentId === item.id) {
          dispatchCandidaturePrefill(item.id);
        } else {
          router.replace(url);
        }
        return;
      }
      router.push(url);
    },
    [branchBase, pathname, router],
  );

  if (!params.branchId || !canSeeNotifications) return null;

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
              disabled={loading}
              title="Actualiser"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="divide-y divide-border/50">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : error ? (
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
                    Aucune demande en attente.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {items.map((item) => (
                  <NotificationRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onConfirm={handleConfirm}
                    onPrefill={handlePrefill}
                    confirming={confirming}
                  />
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
