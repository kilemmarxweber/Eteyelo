"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";
import { EnrollmentUpForm } from "./Enrollment-form";
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
  const peopleLabels = useBranchPeopleLabels();
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
          <DialogTitle>{peopleLabels.editTitle}</DialogTitle>
          <DialogDescription>{peopleLabels.editDescription}</DialogDescription>
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
