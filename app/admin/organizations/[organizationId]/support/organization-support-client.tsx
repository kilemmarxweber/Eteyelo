"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createOrganizationSupportAgentAction,
  updateOrganizationSupportAgentAction,
  deleteOrganizationSupportAgentAction,
} from "./actions";
import { createPlatformEscalationAction } from "@/lib/support/actions";
import { ESCALATION_PRIORITY_LABELS } from "@/lib/support/constants";

type AgentRow = {
  id: string;
  displayTitle: string | null;
  bio: string | null;
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

function parseSpecialties(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function getAgentBranchIds(agent: AgentRow) {
  const scoped = agent.branchScopes
    .map((s) => s.branchId)
    .filter((id): id is string => id != null);
  return scoped;
}

function formatBranchScope(agent: AgentRow, branches: BranchOption[]) {
  const ids = getAgentBranchIds(agent);
  if (ids.length === 0) return "Toute l'organisation";
  const names = ids
    .map((id) => branches.find((b) => b.id === id)?.name)
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "Toute l'organisation";
}

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
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const router = useRouter();
  const [escalationSubject, setEscalationSubject] = useState("");
  const [escalationMessage, setEscalationMessage] = useState("");
  const [escalationPriority, setEscalationPriority] = useState<
    "low" | "normal" | "high"
  >("normal");

  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editSpecialties, setEditSpecialties] = useState("");
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);

  useEffect(() => {
    setAgents(initialAgents);
  }, [initialAgents]);
  function toggleBranchSelection(
    branchId: string,
    current: string[],
    setter: (ids: string[]) => void,
  ) {
    setter(
      current.includes(branchId)
        ? current.filter((id) => id !== branchId)
        : [...current, branchId],
    );
  }

  function openEdit(agent: AgentRow) {
    setEditingAgent(agent);
    setEditTitle(agent.displayTitle ?? "");
    setEditBio(agent.bio ?? "");
    setEditSpecialties(agent.specialties.join(", "));
    setEditIsPrimary(agent.isPrimary);
    setEditBranchIds(getAgentBranchIds(agent));
  }

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
        isPrimary: false,
        branchIds: selectedBranchIds,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Agent support ajouté.");
      setEmail("");
      setName("");
      setDisplayTitle("Support établissement");
      setSelectedBranchIds([]);

      router.refresh();
    });
  }

  function handleSaveEdit() {
    if (!editingAgent) return;

    startTransition(async () => {
      const result = await updateOrganizationSupportAgentAction({
        id: editingAgent.id,
        organizationId,
        displayTitle: editTitle,
        bio: editBio,
        specialties: parseSpecialties(editSpecialties),
        isPrimary: editIsPrimary,
        branchIds: editBranchIds,
        isActive: editingAgent.isActive,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Profil mis à jour.");
      setEditingAgent(null);
      router.refresh();
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
      router.refresh();
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
        priority: escalationPriority,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Escalade envoyée à Klambocore.");
      setEscalationSubject("");
      setEscalationMessage("");
      setEscalationPriority("normal");
      router.refresh();
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
          <Label htmlFor="escalationPriority">Priorité</Label>
          <Select
            value={escalationPriority}
            onValueChange={(value) =>
              setEscalationPriority(value as "low" | "normal" | "high")
            }
          >
            <SelectTrigger id="escalationPriority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ESCALATION_PRIORITY_LABELS).map(
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
    <>
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    Périmètre : {formatBranchScope(agent, branches)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => openEdit(agent)}
                  >
                    <Pencil className="mr-1 size-3.5" />
                    Modifier
                  </Button>
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
            <div className="space-y-2">
              <Label>Établissements couverts</Label>
              <p className="text-xs text-muted-foreground">
                Laissez vide pour couvrir toute l&apos;organisation.
              </p>
              <div className="flex flex-col gap-2 rounded-lg border p-3">
                {branches.map((branch) => (
                  <label
                    key={branch.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedBranchIds.includes(branch.id)}
                      onCheckedChange={() =>
                        toggleBranchSelection(
                          branch.id,
                          selectedBranchIds,
                          setSelectedBranchIds,
                        )
                      }
                    />
                    {branch.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button
            type="button"
            disabled={isPending}
            onClick={handleCreateAgent}
          >
            Créer l&apos;agent support
          </Button>
        </div>
      </section>

      <Dialog
        open={editingAgent != null}
        onOpenChange={(open) => !open && setEditingAgent(null)}
      >
        <DialogContent
          title={`Modifier ${editingAgent?.member.user.name ?? "l'agent"}`}
          className="max-h-[90vh] overflow-y-auto"
        >
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editOrgTitle">Titre affiché</Label>
              <Input
                id="editOrgTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editOrgBio">Bio</Label>
              <Textarea
                id="editOrgBio"
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editOrgSpecialties">
                Spécialités (séparées par des virgules)
              </Label>
              <Input
                id="editOrgSpecialties"
                value={editSpecialties}
                onChange={(e) => setEditSpecialties(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={editIsPrimary}
                onCheckedChange={(checked) =>
                  setEditIsPrimary(checked === true)
                }
              />
              Contact principal
            </label>

            {branches.length > 0 && (
              <div className="space-y-2">
                <Label>Établissements couverts</Label>
                <p className="text-xs text-muted-foreground">
                  Laissez vide pour couvrir toute l&apos;organisation.
                </p>
                <div className="flex flex-col gap-2 rounded-lg border p-3">
                  {branches.map((branch) => (
                    <label
                      key={branch.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={editBranchIds.includes(branch.id)}
                        onCheckedChange={() =>
                          toggleBranchSelection(
                            branch.id,
                            editBranchIds,
                            setEditBranchIds,
                          )
                        }
                      />
                      {branch.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button type="button" disabled={isPending} onClick={handleSaveEdit}>
            Enregistrer
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
