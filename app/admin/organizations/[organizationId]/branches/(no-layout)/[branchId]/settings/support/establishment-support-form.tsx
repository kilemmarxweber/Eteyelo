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

type SupportAgentOption = {
  id: string;
  name: string;
  email: string;
};

type EstablishmentSupportFormProps = {
  organizationId: string;
  supportAgents: SupportAgentOption[];
  selectedAgentId?: string;
  defaultName?: string;
  defaultEmail?: string;
  onAgentChange?: (agentId: string) => void;
};

export function EstablishmentSupportForm({
  organizationId,
  supportAgents,
  selectedAgentId = "",
  defaultName = "",
  defaultEmail = "",
  onAgentChange,
}: EstablishmentSupportFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentId, setAgentId] = useState(selectedAgentId);

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

    const formData = new FormData(event.currentTarget);
    const body = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      subject: String(formData.get("subject") || ""),
      message: String(formData.get("message") || ""),
      organizationId,
      supportAgent: selectedAgent?.name || undefined,
      recipientEmail: selectedAgent?.email || undefined,
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Impossible d'envoyer le message.");
      }

      event.currentTarget.reset();
      toast.success("Message envoyé. L'équipe support vous répondra rapidement.");
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
      {supportAgents.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="support-agent">Destinataire</Label>
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

      {selectedAgent && (
        <Alert>
          <AlertDescription>
            Votre message sera adressé à{" "}
            <span className="font-medium text-foreground">
              {selectedAgent.name}
            </span>
            .
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="support-name">Nom complet</Label>
          <Input
            id="support-name"
            name="name"
            required
            minLength={2}
            defaultValue={defaultName}
            placeholder="Votre nom"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="support-email">Email</Label>
          <Input
            id="support-email"
            name="email"
            type="email"
            required
            defaultValue={defaultEmail}
            placeholder="vous@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="support-phone">Téléphone</Label>
          <Input
            id="support-phone"
            name="phone"
            placeholder="+243..."
          />
        </div>

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
          Envoyer le message
        </Button>
      </div>
    </form>
  );
}
