"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SchoolYearUpForm } from "./SchoolYear-form"; // Importez votre formulaire d'éditionimport { ISchoolYear } from"@/src/interfaces/SchoolYear";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface UpdateSchoolYearDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  schoolYear: ISchoolYear; // Détails de l'année scolaire à éditer
  branchId: string;
}

export function UpdateSchoolYearDialog({
  showTrigger = true,
  onSuccess,
  schoolYear,
  branchId,
  ...props
}: UpdateSchoolYearDialogProps) {
  const [open, setOpen] = React.useState(false);

  const { refresh } = useRefresh();
  const handleUpdate = () => {
    setTimeout(() => {
      refresh(); // Rafraîchir le composant SchoolYearList
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Éditer l'année scolaire</DialogTitle>
          <DialogDescription>
            Modifiez les détails de l'année scolaire ici. Cliquez sur
            Enregistrer lorsque vous êtes fait.
          </DialogDescription>
        </DialogHeader>
        <SchoolYearUpForm
          mode="update"
          initialData={schoolYear} // Pass the schoolYear data for editing
          onSchoolYearAction={handleUpdate}
          branchId={branchId}
        />
      </DialogContent>
    </Dialog>
  );
}
