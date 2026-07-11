"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EnrollmentUpForm } from "./Enrollment-form"; // Importez votre formulaire d'éditionimport { IclassEnrollment } from"@/src/interfaces/Student";
import { IclassEnrollment } from "@/src/interfaces/classEnrollment";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface UpdateStudentDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  classEnrollment: IclassEnrollment; // Détails de l'élève à éditer
}

export function UpdateStudentDialog({
  showTrigger = true,
  onSuccess,
  classEnrollment,
  ...props
}: UpdateStudentDialogProps) {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Éditer l'élève</DialogTitle>
          <DialogDescription>
            Modifiez les détails de l'élève ici. Cliquez sur Enregistrer lorsque
            vous êtes fait.
          </DialogDescription>
        </DialogHeader>
        <EnrollmentUpForm
          mode="update"
          initialData={{
            id: classEnrollment.id ?? "",
            classeId: classEnrollment.classeId ?? "",
            studentId: classEnrollment.studentId ?? "",
            schoolYearId: classEnrollment.schoolYearId ?? "",
          }}
          onUpdated={handleUpdate}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
