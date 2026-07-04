"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePlatformEscalationAction } from "@/lib/support/actions";
import {
  ESCALATION_PRIORITY_LABELS,
  ESCALATION_STATUS_LABELS,
  type EscalationStatus,
} from "@/lib/support/constants";

type EscalationRow = {
  id: string;
  subject: string;
  message: string;
  status: EscalationStatus;
  priority: string;
  createdAt: Date | string;
  organization: { id: string; name: string; slug: string };
  requesterUser: { id: string; name: string; email: string | null };
  assignedPlatformAgent: {
    id: string;
    user: { name: string; email: string | null };
  } | null;
};

type AgentOption = {
  id: string;
  user: { name: string; email?: string | null };
};

type Props = {
  initialEscalations: EscalationRow[];
  platformAgents: AgentOption[];
  canManage: boolean;
};

export function PlatformEscalationsClient({
  initialEscalations,
  platformAgents,
  canManage,
}: Props) {
  const [escalations, setEscalations] = useState(initialEscalations);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(
    id: string,
    data: {
      status?: EscalationStatus;
      assignedPlatformAgentId?: string | null;
    },
  ) {
    const current = escalations.find((e) => e.id === id);
    if (!current) return;

    startTransition(async () => {
      const result = await updatePlatformEscalationAction({
        id,
        status: data.status ?? current.status,
        assignedPlatformAgentId:
          data.assignedPlatformAgentId !== undefined
            ? data.assignedPlatformAgentId
            : current.assignedPlatformAgent?.id ?? null,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setEscalations((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;

          const nextStatus = data.status ?? item.status;
          let nextAssigned = item.assignedPlatformAgent;

          if (data.assignedPlatformAgentId === null) {
            nextAssigned = null;
          } else if (data.assignedPlatformAgentId) {
            const agent = platformAgents.find(
              (a) => a.id === data.assignedPlatformAgentId,
            );
            if (agent) {
              nextAssigned = {
                id: agent.id,
                user: {
                  name: agent.user.name,
                  email: agent.user.email ?? null,
                },
              };
            }
          }

          return {
            ...item,
            status: nextStatus,
            assignedPlatformAgent: nextAssigned,
          };
        }),
      );
      toast.success("Escalade mise à jour.");
    });
  }

  if (escalations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune escalade pour le moment.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {escalations.map((item) => {
        const isExpanded = expandedId === item.id;
        const priorityLabel =
          ESCALATION_PRIORITY_LABELS[
            item.priority as keyof typeof ESCALATION_PRIORITY_LABELS
          ] ?? item.priority;

        return (
          <li
            key={item.id}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.subject}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.organization.name} · {item.requesterUser.name}
                  {item.requesterUser.email
                    ? ` (${item.requesterUser.email})`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("fr-FR")} · Priorité{" "}
                  {priorityLabel}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {ESCALATION_STATUS_LABELS[item.status]}
              </span>
            </div>

            <p
              className={`mt-3 text-sm text-muted-foreground ${isExpanded ? "" : "line-clamp-2"}`}
            >
              {item.message}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                {isExpanded ? "Réduire" : "Voir tout"}
              </Button>
            </div>

            {canManage && (
              <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select
                    value={item.status}
                    disabled={isPending}
                    onValueChange={(value) =>
                      handleUpdate(item.id, {
                        status: value as EscalationStatus,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ESCALATION_STATUS_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Agent assigné</Label>
                  <Select
                    value={item.assignedPlatformAgent?.id ?? "none"}
                    disabled={isPending}
                    onValueChange={(value) =>
                      handleUpdate(item.id, {
                        assignedPlatformAgentId:
                          value === "none" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Non assigné" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non assigné</SelectItem>
                      {platformAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {!canManage && item.assignedPlatformAgent && (
              <p className="mt-3 text-xs text-muted-foreground">
                Assigné à {item.assignedPlatformAgent.user.name}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
