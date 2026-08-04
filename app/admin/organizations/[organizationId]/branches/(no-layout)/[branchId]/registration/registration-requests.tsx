"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  Clock3,
  Eye,
  Loader2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { readClientSearchParam } from "@/lib/client-search-params";
import { dispatchRegistrationPrefill } from "@/lib/prefill-events";
import {
  confirmRegistrationRequestAction,
  getPendingRegistrationRequestsAction,
  rejectRegistrationRequestAction,
} from "./registration.action";

type RegistrationStatusFilter = "ALL" | "PENDING" | "CONFIRMED";

type RegistrationRequestRow = {
  id: string;
  reference: string;
  status: string;
  studentData: Record<string, string> | null;
  guardiansData: Array<Record<string, string>> | null;
  requestedLevel: string | null;
  requestedOption: string | null;
  photoUrl: string | null;
  siblingGroupId: string | null;
  createdAt: Date | string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "En cours",
};

const STATUS_FILTERS: Array<{
  value: RegistrationStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "Toutes" },
  { value: "PENDING", label: "En attente" },
  { value: "CONFIRMED", label: "En cours" },
];

function statusTone(status: string) {
  switch (status) {
    case "PENDING":
      return {
        badge:
          "border-amber-400/60 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        icon: Clock3,
        card: "border-l-amber-400",
      };
    case "CONFIRMED":
      return {
        badge:
          "border-sky-400/60 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
        icon: Eye,
        card: "border-l-sky-400",
      };
    default:
      return {
        badge:
          "border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
        icon: UserPlus,
        card: "border-l-slate-300",
      };
  }
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const Icon = tone.icon;
  return (
    <Badge
      variant="outline"
      className={cn("h-6 gap-1 px-2 text-[11px] font-semibold", tone.badge)}
    >
      <Icon className="size-3" />
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function studentName(student: Record<string, string> | null) {
  if (!student) return "Élève inconnu";
  return (
    [student.name, student.postnom, student.prenom].filter(Boolean).join(" ") ||
    "Élève inconnu"
  );
}

export function RegistrationRequests() {
  const [requests, setRequests] = useState<RegistrationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<RegistrationStatusFilter>("ALL");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ organizationId: string; branchId: string }>();

  const counts = useMemo(() => {
    const base: Record<RegistrationStatusFilter, number> = {
      ALL: requests.length,
      PENDING: 0,
      CONFIRMED: 0,
    };
    for (const request of requests) {
      if (request.status === "PENDING") base.PENDING += 1;
      if (request.status === "CONFIRMED") base.CONFIRMED += 1;
    }
    return base;
  }, [requests]);

  const siblingCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const request of requests) {
      if (!request.siblingGroupId) continue;
      map.set(
        request.siblingGroupId,
        (map.get(request.siblingGroupId) ?? 0) + 1,
      );
    }
    return map;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "ALL") return requests;
    return requests.filter((item) => item.status === statusFilter);
  }, [requests, statusFilter]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const [data, error] = await getPendingRegistrationRequestsAction();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setRequests(
      (data ?? []).map((row) => ({
        ...row,
        siblingGroupId: row.siblingGroupId ?? null,
        studentData:
          row.studentData && typeof row.studentData === "object"
            ? (row.studentData as Record<string, string>)
            : null,
        guardiansData: Array.isArray(row.guardiansData)
          ? (row.guardiansData as Array<Record<string, string>>)
          : null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  function openPrefill(requestId: string) {
    const target = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/registration?requestId=${requestId}`;
    const onRegistrationPage = pathname.includes("/registration");
    const currentId = readClientSearchParam("requestId");

    if (onRegistrationPage) {
      if (currentId === requestId) {
        dispatchRegistrationPrefill(requestId);
      } else {
        router.replace(target);
      }
    } else {
      router.push(target);
    }
  }

  async function handleView(request: RegistrationRequestRow) {
    setBusyId(request.id);
    try {
      if (request.status === "PENDING") {
        const [, error] = await confirmRegistrationRequestAction({
          requestId: request.id,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        setRequests((current) =>
          current.map((item) =>
            item.id === request.id ? { ...item, status: "CONFIRMED" } : item,
          ),
        );
      }
      openPrefill(request.id);
    } finally {
      setBusyId("");
    }
  }

  async function handleReject(request: RegistrationRequestRow) {
    setBusyId(request.id);
    try {
      const [, error] = await rejectRegistrationRequestAction({
        requestId: request.id,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
    } finally {
      setBusyId("");
    }
  }

  if (!loading && requests.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["PENDING", "En attente"],
            ["CONFIRMED", "En cours"],
          ] as const
        ).map(([status, label]) => {
          const tone = statusTone(status);
          const Icon = tone.icon;
          const active = statusFilter === status;
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
                active ? "ring-2 ring-primary/30" : "hover:bg-accent/40",
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
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4" />
            Demandes d&apos;inscription
            <Badge variant="outline">{filteredRequests.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
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
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : filteredRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune demande pour ce filtre.
            </p>
          ) : (
            <div className="grid gap-3">
              {filteredRequests.map((request) => {
                const tone = statusTone(request.status);
                const guardians = request.guardiansData ?? [];
                const levelLabel = [
                  request.requestedLevel,
                  request.requestedOption,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const isBusy = busyId === request.id;

                return (
                  <div
                    key={request.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border border-l-4 bg-background p-4 sm:flex-row sm:items-center sm:justify-between",
                      tone.card,
                    )}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">
                          {studentName(request.studentData)}
                        </p>
                        <StatusBadge status={request.status} />
                        {request.siblingGroupId &&
                        (siblingCounts.get(request.siblingGroupId) ?? 0) > 1 ? (
                          <Badge
                            variant="secondary"
                            className="h-6 text-[11px]"
                          >
                            Fratrie (
                            {siblingCounts.get(request.siblingGroupId)})
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {request.reference} ·{" "}
                        {levelLabel || "Niveau non précisé"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Responsable : {guardians[0]?.name || "-"} ·{" "}
                        {new Date(request.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => void handleView(request)}
                      >
                        {isBusy ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Eye className="mr-2 size-4" />
                        )}
                        Voir la demande
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isBusy}
                        onClick={() => void handleReject(request)}
                      >
                        <XCircle className="mr-2 size-4" />
                        Rejeter
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
