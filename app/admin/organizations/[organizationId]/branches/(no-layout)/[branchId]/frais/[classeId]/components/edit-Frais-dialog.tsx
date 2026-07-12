"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FraisUpForm } from "./frais-form"; // Importez votre formulaire d'éditionimport { IFrais } from"@/src/interfaces/Student";
import { IFrais } from "@/src/interfaces/Frais";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface UpdateFraisDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  frais: IFrais; // Détails de l'élève à éditer
}

export function UpdateFraisDialog({
  showTrigger = true,
  onSuccess,
  frais,
  ...props
}: UpdateFraisDialogProps) {
  const { refresh } = useRefresh();

  const handleUpdate = () => {
    refresh();
    props.onOpenChange?.(false);
  };

  const handleSuccess = () => {
    onSuccess?.();
  };

  return (
    <Dialog {...props}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Éditer l'élève</DialogTitle>
          <DialogDescription>
            Modifiez les détails de l'élève ici. Cliquez sur Enregistrer lorsque
            vous êtes fait.
          </DialogDescription>
        </DialogHeader>
        <FraisUpForm
          mode="update"
          initialData={{
            id: frais.id,
            montantFrais: frais.montantFrais,
            nameFrais: frais.nameFrais,
            statusFrais: frais.statusFrais,
            classeId: frais.classeId || "",
            typeFraisId: frais.typeFraisId || "",
          }} // Pass the frais data for editing
          onUpdated={handleUpdate}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
