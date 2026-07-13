"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Bell,
  UserPlus,
  ChevronRight,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
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
import {
  getPendingRegistrationRequestsAction,
  confirmRegistrationRequestAction,
} from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/registration/registration.action";

// ─── types ──────────────────────────────────────────────────────────────────
type RequestRow = {
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
};

// ─── badge count ─────────────────────────────────────────────────────────────
function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
      <span
        aria-label={`${count} demande${count > 1 ? "s" : ""} en attente`}
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

// ─── skeleton row ─────────────────────────────────────────────────────────────
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

// ─── avatar initiales ─────────────────────────────────────────────────────────
function StudentAvatar({
  photoUrl,
  name,
}: {
  photoUrl: string | null;
  name: string;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className="size-9 shrink-0 rounded-full object-cover ring-2 ring-primary/10"
      />
    );
  }
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
      {initials || <UserPlus className="size-4" />}
    </div>
  );
}

// ─── row ─────────────────────────────────────────────────────────────────────
function RequestRow({
  request,
  onConfirm,
  onExamine,
  confirming,
}: {
  request: RequestRow;
  onConfirm: (id: string) => void;
  onExamine: (id: string) => void;
  confirming: string | null;
}) {
  const student = request.studentData as {
    name?: string;
    postnom?: string;
    prenom?: string;
  } | null;
  const fullName = [student?.name, student?.postnom, student?.prenom]
    .filter(Boolean)
    .join(" ") || "Élève inconnu";

  const level = [request.requestedLevel, request.requestedOption]
    .filter(Boolean)
    .join(" · ");

  const createdAt =
    request.createdAt instanceof Date
      ? request.createdAt
      : new Date(request.createdAt);

  const isPending = request.status === "PENDING";
  const isConfirmed = request.status === "CONFIRMED";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-0",
        "transition-colors hover:bg-accent/50",
      )}
    >
      <StudentAvatar photoUrl={request.photoUrl} name={fullName} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">
          {fullName}
        </p>
        {level && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {level}
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <Clock className="size-3" />
          {formatDistanceToNow(createdAt, { addSuffix: true, locale: fr })}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {isPending && (
          <Badge
            variant="outline"
            className="h-5 border-amber-400/60 bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
          >
            En attente
          </Badge>
        )}
        {isConfirmed && (
          <Badge
            variant="outline"
            className="h-5 border-blue-400/60 bg-blue-50 px-1.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
          >
            Confirmé
          </Badge>
        )}

        <div className="flex gap-1">
          {isPending && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => onConfirm(request.id)}
              disabled={confirming === request.id}
              title="Confirmer la demande"
            >
              {confirming === request.id ? (
                <RefreshCw className="size-3 animate-spin" />
              ) : (
                <CheckCircle className="size-3" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onExamine(request.id)}
            title="Examiner la demande"
          >
            <ChevronRight className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── composant principal ──────────────────────────────────────────────────────
export function NotificationBell() {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Count des PENDING uniquement pour le badge
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, err] = await getPendingRegistrationRequestsAction();
      if (err) {
        setError("Impossible de charger les notifications.");
      } else {
        setRequests((data as RequestRow[]) ?? []);
      }
    } catch {
      setError("Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Charge au montage initial et quand on ouvre le popover
  useEffect(() => {
    if (open) {
      void loadRequests();
    }
  }, [open, loadRequests]);

  // Chargement initial pour avoir le badge à jour
  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  // Polling léger : rafraîchit le count toutes les 60s même si le popover est fermé
  useEffect(() => {
    if (!params.branchId) return;
    const interval = setInterval(() => {
      if (!open) void loadRequests();
    }, 15_000);
    return () => clearInterval(interval);
  }, [open, params.branchId, loadRequests]);

  const handleConfirm = useCallback(
    (id: string) => {
      setConfirming(id);
      startTransition(async () => {
        try {
          const [, err] = await confirmRegistrationRequestAction({ requestId: id });
          if (err) {
            toast.error(err.message ?? "Erreur lors de la confirmation.");
          } else {
            toast.success("Demande confirmée avec succès.");
            // Rafraîchir la liste
            void loadRequests();
          }
        } catch {
          toast.error("Erreur inattendue.");
        } finally {
          setConfirming(null);
        }
      });
    },
    [loadRequests],
  );

  const handleExamine = useCallback(
    (requestId: string) => {
      setOpen(false);
      const base = `/admin/organizations/${params.organizationId}/branches/${params.branchId}`;
      router.push(`${base}/registration?requestId=${requestId}`);
    },
    [params, router],
  );

  const handleViewAll = () => {
    setOpen(false);
    const base = `/admin/organizations/${params.organizationId}/branches/${params.branchId}`;
    router.push(`${base}/registration`);
  };

  if (!params.branchId) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes eteyelo-bell-ring {
          0%, 45%, 100% { transform: rotate(0deg); }
          5%, 15%, 25%, 35% { transform: rotate(13deg); }
          10%, 20%, 30%, 40% { transform: rotate(-13deg); }
        }
        .eteyelo-bell-active {
          animation: eteyelo-bell-ring 2.4s ease-in-out infinite;
          transform-origin: 50% 15%;
        }
        @media (prefers-reduced-motion: reduce) {
          .eteyelo-bell-active { animation: none; }
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
              ? `${pendingCount} demande${pendingCount > 1 ? "s" : ""} d'inscription en attente`
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
        className="w-[360px] max-w-[calc(100vw-1rem)] p-0 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <span className="text-sm font-bold text-foreground">
              Demandes d&apos;inscription
            </span>
            {pendingCount > 0 && (
              <Badge className="h-5 px-1.5 text-[10px] font-bold">
                {pendingCount}
              </Badge>
            )}
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

        {/* Corps */}
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
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Bell className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Tout est à jour
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aucune demande d&apos;inscription en attente.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {requests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onConfirm={handleConfirm}
                  onExamine={handleExamine}
                  confirming={confirming}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && requests.length > 0 && (
          <div className="border-t bg-card px-4 py-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-center text-xs text-primary hover:bg-primary/10 hover:text-primary"
              onClick={handleViewAll}
            >
              Voir toutes les demandes
              <ChevronRight className="ml-1 size-3.5" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
    </>
  );
}
