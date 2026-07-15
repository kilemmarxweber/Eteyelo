"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoursUpForm } from "./cours-form";
import { ICours } from "@/src/interfaces/Cours";

interface UpdateCoursDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  cours: ICours;
  isPrimary?: boolean;
}

export function UpdateCoursDialog({
  showTrigger = true,
  onSuccess,
  cours,
  isPrimary = false,
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
            {isPrimary
              ? "Modifiez le nom, la description ou le domaine du bulletin."
              : "Modifiez le nom ou la description du cours. Le dialogue restera ouvert en cas d'erreur."}
          </DialogDescription>
        </DialogHeader>
        <CoursUpForm
          mode="update"
          isPrimary={isPrimary}
          initialData={{
            id: cours.id,
            codeCours: cours.codeCours,
            nameCours: cours.nameCours,
            description: cours.description,
            primaryDomain: cours.primaryDomain ?? null,
          }}
          onUpdated={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
