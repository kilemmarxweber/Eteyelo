"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClasseUpForm } from "./classe-form";
import { IClasse } from "@/src/interfaces/Classe";

interface UpdateClasseDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  classe: IClasse; // Détails de l'élève à éditer
}

export function UpdateClasseDialog({
  showTrigger = true,
  onSuccess,
  classe,
  ...props
}: UpdateClasseDialogProps) {
  const handleUpdate = () => {
    onSuccess?.();
  };

  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Éditer la classe</DialogTitle>
          <DialogDescription>
            Modifiez les détails de la classe ici. Cliquez sur Enregistrer
            lorsque vous êtes fait.
          </DialogDescription>
        </DialogHeader>
        <ClasseUpForm
          mode="update"
          initialData={{
            id: classe.id,
            codeClasse: classe.codeClasse,
            nameClasse: classe.nameClasse,
            optionId: classe.optionId,
            creneauId: classe.creneauId,
          }}
          onUpdated={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
