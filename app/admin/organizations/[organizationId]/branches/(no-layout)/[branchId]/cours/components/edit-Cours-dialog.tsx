"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoursUpForm } from "./cours-form"; // Importez votre formulaire d'éditionimport { ICours } from"@/src/interfaces/Cours";
import { ICours } from "@/src/interfaces/Cours";

interface UpdateCoursDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  cours: ICours; // Détails de l'élève à éditer
}

export function UpdateCoursDialog({
  showTrigger = true,
  onSuccess,
  cours,
  ...props
}: UpdateCoursDialogProps) {
  const handleUpdate = () => {
    onSuccess?.();
  };

  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le cours</DialogTitle>
          <DialogDescription>
            Modifiez le nom ou la description du cours. Le dialogue restera ouvert en cas d'erreur.
          </DialogDescription>
        </DialogHeader>
        <CoursUpForm
          mode="update"
          initialData={{
            id: cours.id,
            codeCours: cours.codeCours,
            nameCours: cours.nameCours,
            description: cours.description,
          }} // Pass the cours data for editing
          onUpdated={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
