"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { AutoComplete, type Option } from "@/components/autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPlatformSupportAgentAction,
  searchPlatformSupportCandidatesAction,
  updatePlatformSupportAgentAction,
} from "@/lib/support/actions";

type AgentRow = {
  id: string;
  displayTitle: string | null;
  isActive: boolean;
  isLead: boolean;
  specialties: string[];
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

export function PlatformSupportAdminClient({ initialAgents }: Props) {
  const [agents, setAgents] = useState(initialAgents);
  const [selectedUser, setSelectedUser] = useState<Option | undefined>();
  const [displayTitle, setDisplayTitle] = useState("Support plateforme Klambocore");
  const [searchQuery, setSearchQuery] = useState("");
  const [candidateOptions, setCandidateOptions] = useState<Option[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();

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
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Agent support plateforme ajouté.");
      window.location.reload();
    });
  }

  function toggleActive(agent: AgentRow) {
    startTransition(async () => {
      const result = await updatePlatformSupportAgentAction({
        id: agent.id,
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
      toast.success("Statut mis à jour.");
    });
  }

  return (
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
                </p>
              </div>
              <Button
                type="button"
                variant={agent.isActive ? "outline" : "default"}
                size="sm"
                disabled={isPending}
                onClick={() => toggleActive(agent)}
              >
                {agent.isActive ? "Désactiver" : "Activer"}
              </Button>
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
              Recherchez un compte existant par nom ou email. Cette personne
              pourra traiter les escalades de toutes les organisations.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="supportUserSearch">Utilisateur</Label>
            <AutoComplete
              id="supportUserSearch"
              placeholder="Rechercher par nom ou email…"
              emptyMessage="Aucun utilisateur trouvé. Vérifiez l'orthographe ou créez d'abord le compte."
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

        {selectedUser ? (
          <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Compte sélectionné :{" "}
            <span className="font-medium text-foreground">{selectedUser.label}</span>
          </p>
        ) : null}

        <Button
          type="button"
          disabled={isPending || !selectedUser}
          onClick={handleCreate}
        >
          Ajouter l&apos;agent
        </Button>
      </div>
    </section>
  );
}
