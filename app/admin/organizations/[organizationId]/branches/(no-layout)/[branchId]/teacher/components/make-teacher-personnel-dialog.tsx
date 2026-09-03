"use client";

import * as React from "react";
import { useServerAction } from "zsa-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { PERSONNEL_ORG_ROLE_OPTIONS } from "@/lib/dual-staff-profile-shared";
import { ITeacher } from "@/src/interfaces/Teacher";

import { makeTeacherAlsoPersonnelAction } from "../teacher.action";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: ITeacher;
  onSuccess?: () => void;
};

export function MakeTeacherPersonnelDialog({
  open,
  onOpenChange,
  teacher,
  onSuccess,
}: Props) {
  const [orgRole, setOrgRole] = React.useState<
    (typeof PERSONNEL_ORG_ROLE_OPTIONS)[number]
  >(PERSONNEL_ORG_ROLE_OPTIONS[0]);
  const [monthlyForfait, setMonthlyForfait] = React.useState("");
  const { execute, isPending } = useServerAction(makeTeacherAlsoPersonnelAction);

  const fullName =
    [teacher.nom, teacher.postnom, teacher.prenom].filter(Boolean).join(" ") ||
    "cet enseignant";

  async function handleConfirm() {
    const [data, error] = await execute({
      teacherId: teacher.teacherId || teacher.id,
      orgRole,
      ...(monthlyForfait.trim()
        ? { monthlyForfait: Number(monthlyForfait) }
        : {}),
    });
    if (error || !data?.ok) {
      toast.error(data?.message || error?.message || "Échec");
      return;
    }
    toast.success(data.message);
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Rendre aussi personnel</DialogTitle>
          <DialogDescription>
            {fullName} restera enseignant et aura également un profil personnel.
            En cas de désactivation enseignant, le profil personnel restera
            actif.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="dual-org-role">Rôle administratif</Label>
          <Select
            value={orgRole}
            onValueChange={(value) =>
              setOrgRole(value as (typeof PERSONNEL_ORG_ROLE_OPTIONS)[number])
            }
          >
            <SelectTrigger id="dual-org-role">
              <SelectValue placeholder="Choisir un rôle" />
            </SelectTrigger>
            <SelectContent>
              {PERSONNEL_ORG_ROLE_OPTIONS.map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {orgRoleLabel(slug)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 py-2">
          <Label htmlFor="dual-forfait">Forfait mensuel</Label>
          <Input
            id="dual-forfait"
            type="number"
            min={0}
            step="1"
            placeholder="50000"
            value={monthlyForfait}
            onChange={(event) => setMonthlyForfait(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Salaire connu dans la devise de base (ex. 50 000). Requis pour
            payer cet agent avec les enseignants.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Enregistrement…" : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
