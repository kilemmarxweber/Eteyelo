"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, ShieldAlert, KeyRound, User, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchCombobox, type SearchComboboxOption } from "@/components/ui/search-combobox";
import { toast } from "sonner";
import {
  grantTemporaryPrivilegeAction,
  listTemporaryGrantMembersAction,
} from "@/app/admin/organizations/[organizationId]/settings/temporary-grants/actions";
import {
  extraActionsForResource,
  findGrantCatalogGroup,
  GRANT_GROUP_ALL,
  TEMPORARY_GRANT_CATALOG,
} from "@/lib/auth/temporary-grant-catalog";
import { writeActionIncludesRead } from "@/lib/auth/temporary-grant-actions";

type TemporaryGrantModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess?: () => void;
};

const ACTION_OPTIONS = [
  { value: "read", label: "Lecture uniquement (read)" },
  { value: "create", label: "Création (create) + lecture" },
  { value: "update", label: "Modification (update) + lecture" },
  { value: "delete", label: "Suppression (delete) + lecture" },
  { value: "encaisser", label: "Encaissement caisse (encaisser)" },
];

const DURATION_PRESETS = [
  { label: "30 min", value: 30 },
  { label: "1 heure", value: 60 },
  { label: "4 heures", value: 240 },
  { label: "12 heures", value: 720 },
  { label: "24 heures", value: 1440 },
  { label: "7 jours", value: 10080 },
];

function formatMemberLabel(name: string, email?: string | null, role?: string | null) {
  const details = [email, role].filter(Boolean).join(" · ");
  return details ? `${name} (${details})` : name;
}

function toMemberOption(member: {
  userId: string;
  name: string;
  email?: string | null;
  role?: string | null;
}): SearchComboboxOption {
  return {
    value: member.userId,
    label: formatMemberLabel(member.name, member.email, member.role),
    search: [member.name, member.email, member.role].filter(Boolean).join(" "),
  };
}

export function TemporaryGrantModal({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
}: TemporaryGrantModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [memberItems, setMemberItems] = useState<SearchComboboxOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [groupId, setGroupId] = useState<string>("finance");
  const [itemValue, setItemValue] = useState<string>(GRANT_GROUP_ALL);
  const [action, setAction] = useState<string>("read");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [customDuration, setCustomDuration] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const searchTimerRef = useRef<number | null>(null);

  const selectedGroup = findGrantCatalogGroup(groupId);
  const selectedItem =
    itemValue === GRANT_GROUP_ALL
      ? null
      : selectedGroup?.items.find((item) => item.resource === itemValue);
  const canEncaisser =
    itemValue === GRANT_GROUP_ALL
      ? (selectedGroup?.items.some((item) =>
          extraActionsForResource(item.resource).includes("encaisser"),
        ) ?? false)
      : extraActionsForResource(itemValue).includes("encaisser");
  const visibleActions = ACTION_OPTIONS.filter(
    (opt) => opt.value !== "encaisser" || canEncaisser,
  );

  const handleGroupChange = (nextGroupId: string) => {
    setGroupId(nextGroupId);
    setItemValue(GRANT_GROUP_ALL);
    if (action === "encaisser") setAction("read");
  };

  const loadMembers = useCallback(
    async (query?: string) => {
      setLoadingMembers(true);
      try {
        const res = await listTemporaryGrantMembersAction(organizationId, query);
        if (res.ok) {
          setMemberItems(res.members.map(toMemberOption));
        } else {
          toast.error(res.message);
          setMemberItems([]);
        }
      } catch {
        toast.error("Impossible de charger la liste des membres.");
        setMemberItems([]);
      } finally {
        setLoadingMembers(false);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    if (!open) {
      setSelectedUserId("");
      return;
    }
    void loadMembers();
  }, [open, loadMembers]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current != null) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const handleMemberSearch = (query: string) => {
    if (searchTimerRef.current != null) {
      window.clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = window.setTimeout(() => {
      void loadMembers(query);
    }, 250);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      toast.error("Veuillez sélectionner un utilisateur.");
      return;
    }

    if (!reason.trim()) {
      toast.error("Le motif de l'octroi temporaire est obligatoire.");
      return;
    }

    const finalDuration = customDuration ? parseInt(customDuration, 10) : durationMinutes;
    if (isNaN(finalDuration) || finalDuration <= 0) {
      toast.error("Durée invalide.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await grantTemporaryPrivilegeAction(organizationId, {
        targetUserId: selectedUserId,
        groupId,
        itemValue,
        action,
        durationMinutes: finalDuration,
        reason: reason.trim(),
      });

      if (res.ok) {
        toast.success(res.message);
        onOpenChange(false);
        setReason("");
        setSelectedUserId("");
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Une erreur s'est produite lors de l'attribution du privilège.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="h-5 w-5" />
            <DialogTitle>Accorder un Privilège Temporaire</DialogTitle>
          </div>
          <DialogDescription>
            Choisissez un menu puis tout le groupe, ou un sous-menu précis
            (Finance, Cursus, Enseignement, etc.). Le privilège sera révoqué à l&apos;échéance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="user-select" className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-muted-foreground" /> Utilisateur Bénéficiaire
            </Label>
            <SearchCombobox
              id="user-select"
              items={memberItems}
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              onQueryChange={handleMemberSearch}
              filterItems={false}
              placeholder="Rechercher ou sélectionner un membre..."
              emptyText={
                loadingMembers
                  ? "Chargement des membres..."
                  : "Aucun membre trouvé."
              }
              showClear
            />
            {!loadingMembers && memberItems.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {memberItems.length} membre{memberItems.length > 1 ? "s" : ""} affiché
                {memberItems.length > 1 ? "s" : ""}. Cliquez sur le champ pour voir la liste ou tapez pour rechercher.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Menu</Label>
              <Select value={groupId} onValueChange={handleGroupChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPORARY_GRANT_CATALOG.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Sous-menu</Label>
              <Select value={itemValue} onValueChange={setItemValue}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GRANT_GROUP_ALL}>
                    Tout le menu {selectedGroup?.label ?? ""}
                  </SelectItem>
                  {(selectedGroup?.items ?? []).map((item) => (
                    <SelectItem key={item.resource} value={item.resource}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {itemValue === GRANT_GROUP_ALL
                  ? `Accorde les ${selectedGroup?.items.length ?? 0} sous-menus de ${selectedGroup?.label ?? "ce menu"}.`
                  : selectedItem
                    ? `Uniquement « ${selectedItem.label} ».`
                    : "Choisissez un sous-menu ou tout le menu."}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Action Autorisée</Label>
            <Select
              value={visibleActions.some((opt) => opt.value === action) ? action : "read"}
              onValueChange={setAction}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibleActions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {writeActionIncludesRead(action)
                ? "La lecture (Voir le menu et les listes) est incluse automatiquement."
                : action === "read"
                  ? "Lecture seule : l'utilisateur peut consulter, sans créer, modifier ni supprimer."
                  : "L'encaissement s'applique au paiement / caisse. Les rapports restent bloqués sans lecture."}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" /> Durée de Validité
            </Label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  size="sm"
                  variant={durationMinutes === preset.value && !customDuration ? "default" : "outline"}
                  onClick={() => {
                    setDurationMinutes(preset.value);
                    setCustomDuration("");
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="pt-1">
              <Input
                type="number"
                placeholder="Durée sur-mesure en minutes (ex: 90)..."
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason" className="flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" /> Motif de l'Octroi (Requis)
            </Label>
            <Textarea
              id="reason"
              rows={3}
              placeholder="Expliquez la justification (ex: Remplacement exceptionnel à la caisse du 14h à 18h)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Octroi en cours...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" /> Accorder le Privilège
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
