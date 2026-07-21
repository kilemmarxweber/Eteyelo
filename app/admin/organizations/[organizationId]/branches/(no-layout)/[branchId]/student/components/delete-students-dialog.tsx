"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";

import * as React from "react";
import { IconArchive, IconReload } from "@tabler/icons-react";
import { type Row } from "@tanstack/react-table";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IStudent } from "@/src/interfaces/Student";
import { archiveStudentAction } from "../student.action";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

interface DeleteStudentsDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  students: Row<IStudent>["original"][];
}

export function DeleteStudentsDialog({
  showTrigger = true,
  onSuccess,
  students,
  ...props
}: DeleteStudentsDialogProps) {
  const peopleLabels = useBranchPeopleLabels();
  const [isArchivePending, startArchiveTransition] = useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const student of students) {
        const [result, err] = await archiveStudentAction({
          id: student.id,
        });
        if (err) {
          toast.error(err.message ?? "Erreur lors de l'archivage");
          hasError = true;
        } else if (!result?.ok) {
          toast.error(result?.message ?? "Erreur lors de l'archivage");
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          students.length === 1
            ? `${peopleLabels.student} archivé`
            : `${peopleLabels.studentPlural} archivés`,
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = students.length;

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconArchive className="mr-2 size-4" aria-hidden="true" />
            Archiver ({count})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? peopleLabels.archiveTitle
              : `Archiver ${count} ${peopleLabels.studentPluralLower} ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? peopleLabels.archiveDescriptionSingular
              : peopleLabels.archiveDescriptionPlural}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label="Archiver la sélection"
            variant="outline"
            onClick={handleArchive}
            disabled={isArchivePending}
          >
            {isArchivePending && (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Archiver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
