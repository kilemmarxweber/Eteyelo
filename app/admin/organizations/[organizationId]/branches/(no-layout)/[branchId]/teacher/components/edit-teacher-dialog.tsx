"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { ITeacher } from "@/src/interfaces/Teacher";
import { TeacherUpForm } from "./teacher-form";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

interface UpdateTeacherDialogProps
  extends React.ComponentPropsWithoutRef<typeof Sheet> {
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
  const peopleLabels = useBranchPeopleLabels();

  const handleUpdated = () => {
    refresh();
    onSuccess?.();
    onOpenChange?.(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} {...dialogProps}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-[min(100vw,40rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle>Modifier le {peopleLabels.teacherLower}</SheetTitle>
          <SheetDescription>
            Ajustez les informations du {peopleLabels.teacherLower}, puis
            enregistrez.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
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
                image: teacher.image ?? "",
                estTitulaire: teacher.estTitulaire ?? false,
                classeId: teacher.classeId ?? "",
                coursId: teacher.coursId ?? "",
                cycles: teacher.cycles ?? [],
              }}
              onTeacherUpdate={handleUpdated}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
