"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { grantTemporaryPrivilegeAction } from "@/app/admin/organizations/[organizationId]/settings/temporary-grants/actions";

type MemberOption = {
  userId: string;
  name: string;
  email?: string | null;
  role?: string | null;
};

type TemporaryGrantModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  members: MemberOption[];
  onSuccess?: () => void;
};

const RESOURCE_OPTIONS = [
  { value: "finance", label: "Finances & Caisse (finance)" },
  { value: "notes", label: "Notes & Bulletins (notes)" },
  { value: "student", label: "Annuaire Élèves (student)" },
  { value: "inscription", label: "Inscriptions (inscription)" },
  { value: "candidatures", label: "Candidatures recrutement (candidatures)" },
  { value: "payroll", label: "Paie des enseignants (payroll)" },
  { value: "attendance", label: "Présences (attendance)" },
  { value: "devoirs", label: "Devoirs & Cours (devoirs)" },
  { value: "schedule", label: "Horaire & Vacations (schedule)" },
  { value: "messaging", label: "Messagerie interne (messaging)" },
  { value: "settings", label: "Paramètres d'établissement (settings)" },
];

const ACTION_OPTIONS = [
  { value: "read", label: "Lecture uniquement (read)" },
  { value: "create", label: "Création (create)" },
  { value: "update", label: "Modification (update)" },
  { value: "delete", label: "Suppression (delete)" },
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

export function TemporaryGrantModal({
  open,
  onOpenChange,
  organizationId,
  members,
  onSuccess,
}: TemporaryGrantModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [resource, setResource] = useState<string>("finance");
  const [action, setAction] = useState<string>("read");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [customDuration, setCustomDuration] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
        resource,
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="h-5 w-5" />
            <DialogTitle>Accorder un Privilège Temporaire</DialogTitle>
          </div>
          <DialogDescription>
            Attribuez temporairement des droits d'accès à un utilisateur quel que soit son rôle.
            Le privilège sera automatiquement révoqué à l'échéance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Utilisateur cible */}
          <div className="space-y-1.5">
            <Label htmlFor="user-select" className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-muted-foreground" /> Utilisateur Bénéficiaire
            </Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user-select">
                <SelectValue placeholder="Sélectionnez un membre..." />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name} {m.email ? `(${m.email})` : ""} {m.role ? `- ${m.role}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ressource & Action */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ressource Cible</Label>
              <Select value={resource} onValueChange={setResource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Action Autorisée</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Durée */}
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

          {/* Motif / Raison */}
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
