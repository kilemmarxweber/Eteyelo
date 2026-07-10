"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OptionUpForm } from "./option-form"; // Importez votre formulaire d'éditionimport { IOption } from"@/src/interfaces/Option";
import { IOption } from "@/src/interfaces/Option";

interface UpdateOptionDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  option: IOption; // Détails de l'élève à éditer
}

export function UpdateOptionDialog({
  showTrigger = true,
  onSuccess,
  option,
  ...props
}: UpdateOptionDialogProps) {
  const handleUpdate = () => {
    onSuccess?.();
  };

  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Éditer l'élève</DialogTitle>
          <DialogDescription>
            Modifiez les détails de l'élève ici. Cliquez sur Enregistrer lorsque
            vous êtes fait.
          </DialogDescription>
        </DialogHeader>
        <OptionUpForm
          mode="update"
          initialData={{
            id: option.id,
            codeOption: option.codeOption,
            nameOption: option.nameOption,
            sectionId: option.sectionId,
          }} // Pass the option data for editing
          onUpdated={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
