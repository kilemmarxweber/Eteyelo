"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreneauUpForm } from "./creneau-form";
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
      <DialogContent className="max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Modifier la vacation</DialogTitle>
          <DialogDescription>
            Mettez à jour les horaires, la durée des cours et la récréation.
          </DialogDescription>
        </DialogHeader>
        <CreneauUpForm
          mode="update"
          initialData={creneau}
          onUpdated={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
