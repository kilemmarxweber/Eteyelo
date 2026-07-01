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
  ...props
}: UpdateTeacherDialogProps) {
  const [open, setOpen] = React.useState(false);

  const handleUpdate = () => {
    onSuccess?.();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} {...props}>
      <DialogContent>
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
