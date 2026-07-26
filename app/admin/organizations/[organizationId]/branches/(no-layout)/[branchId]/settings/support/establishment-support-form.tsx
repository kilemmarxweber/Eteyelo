"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/custom/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createBranchSupportTicketAction } from "@/lib/support/actions";
import { SUPPORT_TICKET_CHANNEL_LABELS } from "@/lib/support/constants";

type SupportAgentOption = {
  id: string;
  name: string;
  email: string;
};

type EstablishmentSupportFormProps = {
  organizationId: string;
  branchId: string;
  supportAgents: SupportAgentOption[];
  selectedAgentId?: string;
  onAgentChange?: (agentId: string) => void;
  onCreated?: () => void;
};

export function EstablishmentSupportForm({
  organizationId,
  branchId,
  supportAgents,
  selectedAgentId = "",
  onAgentChange,
  onCreated,
}: EstablishmentSupportFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentId, setAgentId] = useState(selectedAgentId);
  const [channel, setChannel] = useState<"ESTABLISHMENT" | "PLATFORM">(
    "ESTABLISHMENT",
  );
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");

  useEffect(() => {
    setAgentId(selectedAgentId);
  }, [selectedAgentId]);

  const selectedAgent = supportAgents.find((agent) => agent.id === agentId);

  function handleAgentChange(value: string) {
    const nextValue = value === "all" ? "" : value;
    setAgentId(nextValue);
    onAgentChange?.(nextValue);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const result = await createBranchSupportTicketAction({
        organizationId,
        branchId,
        channel,
        subject: String(formData.get("subject") || ""),
        message: String(formData.get("message") || ""),
        priority,
        organizationSupportId:
          channel === "ESTABLISHMENT" && agentId ? agentId : null,
      });

      if (!result.ok) {
        throw new Error(result.message);
      }

      form.reset();
      setPriority("normal");
      toast.success(
        channel === "PLATFORM"
          ? "Demande escaladée vers Klambocore."
          : "Demande envoyée au support établissement.",
      );
      onCreated?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue lors de l'envoi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="support-channel">Escalader vers</Label>
        <Select
          value={channel}
          onValueChange={(value) =>
            setChannel(value as "ESTABLISHMENT" | "PLATFORM")
          }
        >
          <SelectTrigger id="support-channel" className="w-full sm:w-[320px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ESTABLISHMENT">
              {SUPPORT_TICKET_CHANNEL_LABELS.ESTABLISHMENT}
            </SelectItem>
            <SelectItem value="PLATFORM">
              {SUPPORT_TICKET_CHANNEL_LABELS.PLATFORM}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {channel === "ESTABLISHMENT" && supportAgents.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="support-agent">Destinataire (optionnel)</Label>
          <Select
            value={agentId || "all"}
            onValueChange={handleAgentChange}
          >
            <SelectTrigger id="support-agent" className="w-full sm:w-[320px]">
              <SelectValue placeholder="Choisir un interlocuteur" />
            </SelectTrigger>
            <SelectContent>
              {supportAgents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
              <SelectItem value="all">Toute l&apos;équipe support</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {channel === "ESTABLISHMENT" && selectedAgent && (
        <Alert>
          <AlertDescription>
            Votre demande sera adressée à{" "}
            <span className="font-medium text-foreground">
              {selectedAgent.name}
            </span>
            .
          </AlertDescription>
        </Alert>
      )}

      {channel === "PLATFORM" && (
        <Alert>
          <AlertDescription>
            Votre demande sera escaladée directement à l&apos;équipe Klambocore.
            Vous pourrez suivre son statut ci-dessous.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="support-subject">Sujet</Label>
          <Input
            id="support-subject"
            name="subject"
            required
            minLength={3}
            placeholder="Objet de votre demande"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="support-priority">Priorité</Label>
          <Select
            value={priority}
            onValueChange={(value) =>
              setPriority(value as "low" | "normal" | "high")
            }
          >
            <SelectTrigger id="support-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Basse</SelectItem>
              <SelectItem value="normal">Normale</SelectItem>
              <SelectItem value="high">Haute</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="support-message">Message</Label>
        <Textarea
          id="support-message"
          name="message"
          required
          minLength={10}
          rows={5}
          placeholder="Décrivez votre problème ou votre besoin..."
          className="min-h-[120px] resize-none"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="submit"
          className="w-full sm:w-auto"
          loading={isSubmitting}
          leftSection={<Send className="size-4" />}
        >
          Escalader la demande
        </Button>
      </div>
    </form>
  );
}
