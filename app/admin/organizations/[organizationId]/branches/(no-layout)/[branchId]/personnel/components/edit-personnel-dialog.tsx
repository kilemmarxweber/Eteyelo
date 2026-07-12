"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonnelUpForm } from "./personnel-form"; // Importez votre formulaire d'éditionimport { IParent } from"@/src/interfaces/Parent";
import { IPersonnel } from "@/src/interfaces/Personnel";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";

interface UpdatePersonnelDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  personnel: IPersonnel;
}

export function UpdatePersonnelDialog({
  showTrigger = true,
  onSuccess,
  personnel,
  open: controlledOpen,
  onOpenChange,
  ...dialogProps
}: UpdatePersonnelDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const { refresh } = useRefresh();
  const handleUpdate = () => {
    refresh();
    onSuccess?.();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} {...dialogProps}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Éditer le personnel</DialogTitle>
          <DialogDescription>
            Modifiez les détails du personnel ici. Cliquez sur mettre a jour
            lorsque vous êtes prêt.
          </DialogDescription>
        </DialogHeader>
        <PersonnelUpForm
          mode="update"
          initialData={{
            personnelId: personnel.personnelId ?? "",
            username: personnel.username ?? "",
            name: personnel.nom,
            prenom: personnel.prenom ?? "",
            postnom: personnel.postnom,
            sexe: personnel.sexe,
            telephone: personnel.telephone ?? "",
            email: personnel.email ?? "",
            dateOfBirth: personnel.dateOfBirth,
            address: personnel.address,
            orgRole: personnel.role ?? ALL_ORG_ROLE_SLUGS[2],
          }} // Pass the personnel data for editing
          onPersonnelUpdate={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
