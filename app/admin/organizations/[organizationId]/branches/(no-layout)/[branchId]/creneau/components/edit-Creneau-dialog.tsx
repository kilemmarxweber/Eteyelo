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
import { useRefresh } from "@/src/hooks/RefreshContext";

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
  const [open, setOpen] = React.useState(false);

  const { refresh } = useRefresh();
  const handleUpdate = () => {
    setTimeout(() => {
      refresh(); // Rafraîchir le composant CreneauList
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} {...props}>
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
          onCreneauAction={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
