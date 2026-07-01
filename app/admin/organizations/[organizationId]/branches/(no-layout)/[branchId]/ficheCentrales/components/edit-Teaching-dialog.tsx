"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EnrollmentUpForm } from "./Teaching-form"; // Importez votre formulaire d'éditionimport { ITeaching } from"@/src/interfaces/Student";
import { ITeaching } from "@/src/interfaces/Teaching";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface UpdateStudentDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  teaching: ITeaching; // Détails de l'enseignant à éditer
}

export function UpdateStudentDialog({
  showTrigger = true,
  onSuccess,
  teaching,
  ...props
}: UpdateStudentDialogProps) {
  const [open, setOpen] = React.useState(false);

  const { refresh } = useRefresh();
  const handleUpdate = () => {
    setTimeout(() => {
      console.log("Delayed for 1 second.");
      refresh(); // Rafraîchir le composant UserList
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Éditer l'enseignant</DialogTitle>
          <DialogDescription>
            Modifiez les détails de l'enseignant ici. Cliquez sur Enregistrer
            lorsque vous êtes fait.
          </DialogDescription>
        </DialogHeader>
        <EnrollmentUpForm
          mode="update"
          initialData={{
            id: teaching.id ?? "",
            classeId: teaching.classeId ?? "",
            teacherId: teaching.teacherId ?? "",
            titulaire: teaching.titulaire,
            schoolYearId: teaching.schoolYearId ?? "",
            coursId: teaching.coursId ?? "",
          }} // Pass the teaching data for editing
          onEnrollmentAction={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
