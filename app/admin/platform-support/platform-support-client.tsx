"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, UserPlus } from "lucide-react";
import { AutoComplete, type Option } from "@/components/autocomplete";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createPlatformSupportAgentAction,
  searchPlatformSupportCandidatesAction,
  updatePlatformSupportAgentAction,
} from "@/lib/support/actions";

type AgentRow = {
  id: string;
  displayTitle: string | null;
  bio: string | null;
  specialties: string[];
  image: string | null;
  isActive: boolean;
  isLead: boolean;
  sortOrder: number;
  user: {
    id: string;
    name: string;
    email: string | null;
    role: string | null;
  };
};

type CandidateUser = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
};

type Props = {
  initialAgents: AgentRow[];
};

function formatCandidateLabel(user: CandidateUser) {
  return user.email ? `${user.name} (${user.email})` : user.name;
}

function parseSpecialties(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function PlatformSupportAdminClient({ initialAgents }: Props) {
  const [agents, setAgents] = useState(initialAgents);
  const [selectedUser, setSelectedUser] = useState<Option | undefined>();
  const [displayTitle, setDisplayTitle] = useState("Support plateforme Klambocore");
  const [searchQuery, setSearchQuery] = useState("");
  const [candidateOptions, setCandidateOptions] = useState<Option[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editSpecialties, setEditSpecialties] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editIsLead, setEditIsLead] = useState(false);
  const [editSortOrder, setEditSortOrder] = useState(0);

  const loadCandidates = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setCandidateOptions([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchPlatformSupportCandidatesAction(trimmed);
      if (!result.ok) {
        setCandidateOptions([]);
        return;
      }

      setCandidateOptions(
        result.users.map((user) => ({
          value: user.id,
          label: formatCandidateLabel(user),
        })),
      );
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCandidates(searchQuery);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [loadCandidates, searchQuery]);

  function openEdit(agent: AgentRow) {
    setEditingAgent(agent);
    setEditTitle(agent.displayTitle ?? "");
    setEditBio(agent.bio ?? "");
    setEditSpecialties(agent.specialties.join(", "));
    setEditImage(agent.image ?? "");
    setEditIsLead(agent.isLead);
    setEditSortOrder(agent.sortOrder);
  }

  function handleCreate() {
    if (!selectedUser?.value) {
      toast.error("Sélectionnez un utilisateur dans la liste.");
      return;
    }

    startTransition(async () => {
      const result = await createPlatformSupportAgentAction({
        userId: selectedUser.value,
        displayTitle,
        specialties: [],
        isLead: false,
        sortOrder: agents.length,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Agent support plateforme ajouté.");
      window.location.reload();
    });
  }

  function handleSaveEdit() {
    if (!editingAgent) return;

    startTransition(async () => {
      const result = await updatePlatformSupportAgentAction({
        id: editingAgent.id,
        displayTitle: editTitle,
        bio: editBio,
        specialties: parseSpecialties(editSpecialties),
        image: editImage,
        isLead: editIsLead,
        sortOrder: editSortOrder,
        isActive: editingAgent.isActive,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setAgents((prev) =>
        prev.map((a) =>
          a.id === editingAgent.id
            ? {
                ...a,
                displayTitle: editTitle,
                bio: editBio,
                specialties: parseSpecialties(editSpecialties),
                image: editImage || null,
                isLead: editIsLead,
                sortOrder: editSortOrder,
              }
            : a,
        ),
      );
      setEditingAgent(null);
      toast.success("Profil mis à jour.");
    });
  }

  function toggleActive(agent: AgentRow) {
    startTransition(async () => {
      const result = await updatePlatformSupportAgentAction({
        id: agent.id,
        isActive: !agent.isActive,
        specialties: agent.specialties,
        isLead: agent.isLead,
        sortOrder: agent.sortOrder,
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
      toast.success("Statut mis à jour.");
    });
  }

  return (
    <>
      <section className="space-y-6 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Agents actifs</h2>

        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun agent configuré. Ajoutez un membre de l&apos;équipe ci-dessous.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{agent.user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {agent.user.email} · {agent.displayTitle ?? "Support"}
                    {agent.isLead ? " · Référent" : ""}
                  </p>
                  {agent.specialties.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {agent.specialties.join(" · ")}
                    </p>
                  )}
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
                    variant={agent.isActive ? "outline" : "default"}
                    size="sm"
                    disabled={isPending}
                    onClick={() => toggleActive(agent)}
                  >
                    {agent.isActive ? "Désactiver" : "Activer"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-4 border-t pt-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <UserPlus className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium">Ajouter un agent Klambocore</h3>
              <p className="text-sm text-muted-foreground">
                Recherchez un compte existant par nom ou email.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supportUserSearch">Utilisateur</Label>
              <AutoComplete
                id="supportUserSearch"
                placeholder="Rechercher par nom ou email…"
                emptyMessage="Aucun utilisateur trouvé."
                options={candidateOptions}
                value={selectedUser}
                isLoading={isSearching}
                onInputChange={(query) => {
                  setSearchQuery(query);
                  if (selectedUser && query !== selectedUser.label) {
                    setSelectedUser(undefined);
                  }
                }}
                onValueChange={(option) => {
                  setSelectedUser(option);
                  setSearchQuery(option.label);
                }}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="displayTitle">Titre affiché publiquement</Label>
              <Input
                id="displayTitle"
                value={displayTitle}
                onChange={(e) => setDisplayTitle(e.target.value)}
                placeholder="Ex. Support technique Klambocore"
              />
            </div>
          </div>

          <Button
            type="button"
            disabled={isPending || !selectedUser}
            onClick={handleCreate}
          >
            Ajouter l&apos;agent
          </Button>
        </div>
      </section>

      <Dialog
        open={editingAgent != null}
        onOpenChange={(open) => !open && setEditingAgent(null)}
      >
        <DialogContent
          title={`Modifier ${editingAgent?.user.name ?? "l'agent"}`}
          className="max-h-[90vh] overflow-y-auto"
        >
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editTitle">Titre affiché</Label>
              <Input
                id="editTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editBio">Bio</Label>
              <Textarea
                id="editBio"
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editSpecialties">
                Spécialités (séparées par des virgules)
              </Label>
              <Input
                id="editSpecialties"
                value={editSpecialties}
                onChange={(e) => setEditSpecialties(e.target.value)}
                placeholder="Comptes, Paiements, Incidents"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editImage">URL de la photo</Label>
              <Input
                id="editImage"
                value={editImage}
                onChange={(e) => setEditImage(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editSortOrder">Ordre d&apos;affichage</Label>
              <Input
                id="editSortOrder"
                type="number"
                min={0}
                value={editSortOrder}
                onChange={(e) => setEditSortOrder(Number(e.target.value) || 0)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={editIsLead}
                onCheckedChange={(checked) => setEditIsLead(checked === true)}
              />
              Référent de l&apos;équipe
            </label>
          </div>

          <Button
            type="button"
            disabled={isPending}
            onClick={handleSaveEdit}
          >
            Enregistrer
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
