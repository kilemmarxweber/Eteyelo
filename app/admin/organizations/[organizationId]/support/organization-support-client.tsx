"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createOrganizationSupportAgentAction,
  updateOrganizationSupportAgentAction,
  deleteOrganizationSupportAgentAction,
} from "./actions";
import { createPlatformEscalationAction } from "@/lib/support/actions";

type AgentRow = {
  id: string;
  displayTitle: string | null;
  isActive: boolean;
  isPrimary: boolean;
  specialties: string[];
  member: {
    user: { name: string; email: string | null };
  };
  branchScopes: Array<{
    branchId: string | null;
    branch: { id: string; name: string } | null;
  }>;
};

type BranchOption = { id: string; name: string };

type Props = {
  organizationId: string;
  initialAgents: AgentRow[];
  branches: BranchOption[];
  escalationOnly?: boolean;
};

export function OrganizationSupportClient({
  organizationId,
  initialAgents,
  branches,
  escalationOnly = false,
}: Props) {
  const [agents, setAgents] = useState(initialAgents);
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [displayTitle, setDisplayTitle] = useState("Support établissement");

  const [escalationSubject, setEscalationSubject] = useState("");
  const [escalationMessage, setEscalationMessage] = useState("");

  function handleCreateAgent() {
    if (!email.trim() || !name.trim()) {
      toast.error("Nom et email requis.");
      return;
    }

    startTransition(async () => {
      const result = await createOrganizationSupportAgentAction({
        organizationId,
        email: email.trim(),
        name: name.trim(),
        displayTitle,
        specialties: [],
        branchIds: [],
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Agent support ajouté.");
      window.location.reload();
    });
  }

  function toggleActive(agent: AgentRow) {
    startTransition(async () => {
      const result = await updateOrganizationSupportAgentAction({
        id: agent.id,
        organizationId,
        isActive: !agent.isActive,
        specialties: agent.specialties,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id ? { ...a, isActive: !a.isActive } : a,
        ),
      );
    });
  }

  function handleDelete(agentId: string) {
    startTransition(async () => {
      const result = await deleteOrganizationSupportAgentAction({
        id: agentId,
        organizationId,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      toast.success("Agent retiré.");
    });
  }

  function handleEscalation() {
    if (!escalationSubject.trim() || escalationMessage.trim().length < 10) {
      toast.error("Sujet et message (min. 10 caractères) requis.");
      return;
    }

    startTransition(async () => {
      const result = await createPlatformEscalationAction({
        organizationId,
        subject: escalationSubject.trim(),
        message: escalationMessage.trim(),
        priority: "normal",
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Escalade envoyée à Klambocore.");
      setEscalationSubject("");
      setEscalationMessage("");
      window.location.reload();
    });
  }

  if (escalationOnly) {
    return (
      <div className="grid gap-3">
        <div className="space-y-2">
          <Label htmlFor="escalationSubject">Sujet</Label>
          <Input
            id="escalationSubject"
            value={escalationSubject}
            onChange={(e) => setEscalationSubject(e.target.value)}
            placeholder="Ex. Erreur synchronisation paiements"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="escalationMessage">Description détaillée</Label>
          <Textarea
            id="escalationMessage"
            rows={5}
            value={escalationMessage}
            onChange={(e) => setEscalationMessage(e.target.value)}
            placeholder="Décrivez le problème, les étapes reproduites, l'impact..."
          />
        </div>
        <Button type="button" disabled={isPending} onClick={handleEscalation}>
          Envoyer à Klambocore
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Agents support internes</h2>

      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun agent. Créez le premier ci-dessous.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">{agent.member.user.name}</p>
                <p className="text-sm text-muted-foreground">
                  {agent.member.user.email} ·{" "}
                  {agent.displayTitle ?? "Support établissement"}
                  {agent.isPrimary ? " · Contact principal" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => toggleActive(agent)}
                >
                  {agent.isActive ? "Désactiver" : "Activer"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(agent.id)}
                >
                  Retirer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t pt-5">
        <h3 className="font-medium">Ajouter un agent</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="supportName">Nom complet</Label>
            <Input
              id="supportName"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Email</Label>
            <Input
              id="supportEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="orgDisplayTitle">Titre affiché</Label>
            <Input
              id="orgDisplayTitle"
              value={displayTitle}
              onChange={(e) => setDisplayTitle(e.target.value)}
            />
          </div>
        </div>
        {branches.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Par défaut, l&apos;agent couvre toute l&apos;organisation. Le
            périmètre par établissement sera configurable dans une prochaine
            version.
          </p>
        )}
        <Button type="button" disabled={isPending} onClick={handleCreateAgent}>
          Créer l&apos;agent support
        </Button>
      </div>
    </section>
  );
}
