"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ESCALATION_PRIORITY_LABELS,
  ESCALATION_STATUS_LABELS,
  SUPPORT_TICKET_CHANNEL_LABELS,
  type EscalationStatus,
  type SupportTicketChannel,
} from "@/lib/support/constants";

export type MySupportTicket = {
  id: string;
  subject: string;
  message: string;
  status: EscalationStatus;
  priority: string;
  channel: SupportTicketChannel;
  createdAt: Date | string;
  updatedAt: Date | string;
  resolvedAt: Date | string | null;
  branch: { id: string; name: string } | null;
};

type MySupportTicketsProps = {
  tickets: MySupportTicket[];
};

function statusVariant(status: EscalationStatus) {
  switch (status) {
    case "RESOLVED":
    case "CLOSED":
      return "secondary" as const;
    case "IN_PROGRESS":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

export function MySupportTickets({ tickets }: MySupportTicketsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Mes demandes</CardTitle>
        <CardDescription>
          Uniquement les tickets que vous avez escaladés. Le statut se met à
          jour lorsque le support traite votre demande.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Aucune demande pour le moment. Escaladez un souci via le formulaire
            ci-dessus.
          </p>
        ) : (
          <ul className="space-y-3">
            {tickets.map((ticket) => {
              const statusLabel =
                ESCALATION_STATUS_LABELS[ticket.status] ?? ticket.status;
              const channelLabel =
                SUPPORT_TICKET_CHANNEL_LABELS[ticket.channel] ?? ticket.channel;
              const priorityLabel =
                ESCALATION_PRIORITY_LABELS[
                  ticket.priority as keyof typeof ESCALATION_PRIORITY_LABELS
                ] ?? ticket.priority;

              return (
                <li
                  key={ticket.id}
                  className="rounded-lg border bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium leading-tight">
                        {ticket.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {channelLabel} · Priorité {priorityLabel} ·{" "}
                        {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <Badge variant={statusVariant(ticket.status)}>
                      {statusLabel}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                    {ticket.message}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
