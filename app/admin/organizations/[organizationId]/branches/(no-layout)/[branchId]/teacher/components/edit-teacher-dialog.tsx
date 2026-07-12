"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ITeacher } from "@/src/interfaces/Teacher";
import { TeacherUpForm } from "./teacher-form";

interface UpdateTeacherDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  teacher: ITeacher;
}

export function UpdateTeacherDialog({
  showTrigger = true,
  onSuccess,
  teacher,
  open: controlledOpen,
  onOpenChange,
  ...dialogProps
}: UpdateTeacherDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const handleUpdate = () => {
    onSuccess?.();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} {...dialogProps}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Editer l'enseignant</DialogTitle>
          <DialogDescription>
            Modifiez les details de l'enseignant ici.
          </DialogDescription>
        </DialogHeader>
        <TeacherUpForm
          mode="update"
          initialData={{
            teacherId: teacher.id ?? "",
            username: teacher.username ?? "",
            nom: teacher.nom,
            prenom: teacher.prenom ?? "",
            postnom: teacher.postnom,
            sexe: teacher.sexe,
            telephone: teacher.telephone ?? "",
            email: teacher.email ?? "",
            dateOfBirth: teacher.dateOfBirth,
            address: teacher.address ?? "",
          }}
          onTeacherUpdate={handleUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
