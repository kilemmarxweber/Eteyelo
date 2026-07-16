"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { ITeacher } from "@/src/interfaces/Teacher";
import { TeacherUpForm } from "./teacher-form";

interface UpdateTeacherDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  onSuccess?: () => void;
  teacher: ITeacher;
}

export function UpdateTeacherDialog({
  onSuccess,
  teacher,
  open,
  onOpenChange,
  ...dialogProps
}: UpdateTeacherDialogProps) {
  const { refresh } = useRefresh();

  const handleUpdated = () => {
    refresh();
    onSuccess?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...dialogProps}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;enseignant</DialogTitle>
          <DialogDescription>
            Ajustez les informations de l&apos;enseignant, puis enregistrez.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <TeacherUpForm
            key={teacher.id}
            layout="dialog"
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
            onTeacherUpdate={handleUpdated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
