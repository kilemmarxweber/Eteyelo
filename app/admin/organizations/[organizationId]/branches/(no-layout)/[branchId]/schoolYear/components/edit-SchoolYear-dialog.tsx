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

import { useSchoolYearLabels } from "@/hooks/use-school-year-labels";

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
  const { labelLower } = useSchoolYearLabels();
  const { refresh } = useRefresh();

  const handleUpdate = () => {
    refresh();
    onSuccess?.();
  };

  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Éditer l'${labelLower}`}</DialogTitle>
          <DialogDescription>
            {`Modifiez les détails de l'${labelLower} ici. Cliquez sur Enregistrer lorsque vous avez terminé.`}
          </DialogDescription>
        </DialogHeader>
        <SchoolYearUpForm
          mode="update"
          initialData={schoolYear} // Pass the schoolYear data for editing
          onUpdated={handleUpdate}
          branchId={branchId}
        />
      </DialogContent>
    </Dialog>
  );
}
