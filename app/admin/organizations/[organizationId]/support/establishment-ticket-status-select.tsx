"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateEstablishmentSupportTicketAction } from "@/lib/support/actions";
import {
  ESCALATION_STATUS_LABELS,
  type EscalationStatus,
} from "@/lib/support/constants";

type Props = {
  ticketId: string;
  organizationId: string;
  status: EscalationStatus;
};

export function EstablishmentTicketStatusSelect({
  ticketId,
  organizationId,
  status,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(nextStatus: string) {
    startTransition(async () => {
      const result = await updateEstablishmentSupportTicketAction({
        id: ticketId,
        organizationId,
        status: nextStatus as EscalationStatus,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Statut mis à jour.");
      router.refresh();
    });
  }

  return (
    <Select
      value={status}
      onValueChange={onChange}
      disabled={isPending}
    >
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue placeholder="Statut" />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ESCALATION_STATUS_LABELS) as EscalationStatus[]).map(
          (key) => (
            <SelectItem key={key} value={key}>
              {ESCALATION_STATUS_LABELS[key]}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  );
}
