"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreneauUpForm } from "./creneau-form"; // Importez votre formulaire d'éditionimport { ICreneau } from"@/src/interfaces/Creneau";
import { ICreneau } from "@/src/interfaces/creneau";

interface UpdateCreneauDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  creneau: ICreneau; // Détails de leélève à éditer
}

export function UpdateCreneauDialog({
  showTrigger = true,
  onSuccess,
  creneau,
  ...props
}: UpdateCreneauDialogProps) {
  const handleUpdate = () => {
    onSuccess?.();
  };

  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Éditer la vacation</DialogTitle>
          <DialogDescription>
            Modifiez les détails du vacation ici. Cliquez sur Enregistrer
          </DialogDescription>
        </DialogHeader>
        <CreneauUpForm
          mode="update"
          initialData={creneau} // Pass the creneau data for editing
          onUpdated={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
