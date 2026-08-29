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
import { IPersonnel } from "@/src/interfaces/Personnel";

import { makePersonnelAlsoTeacherAction } from "../personnel.action";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel: IPersonnel;
  onSuccess?: () => void;
};

export function MakePersonnelTeacherDialog({
  open,
  onOpenChange,
  personnel,
  onSuccess,
}: Props) {
  const { execute, isPending } = useServerAction(makePersonnelAlsoTeacherAction);

  const fullName =
    [personnel.nom, personnel.postnom, personnel.prenom]
      .filter(Boolean)
      .join(" ") || "ce personnel";

  async function handleConfirm() {
    const [data, error] = await execute({
      personnelId: personnel.personnelId || personnel.id,
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
          <DialogTitle>Rendre aussi enseignant</DialogTitle>
          <DialogDescription>
            {fullName} restera personnel et aura également un profil enseignant.
            Vous pourrez ensuite lui affecter des cours.
          </DialogDescription>
        </DialogHeader>

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
