"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";

import * as React from "react";
import { IconArchive, IconReload, IconTrash } from "@tabler/icons-react";
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
import {
  archiveStudentAction,
  deleteStudentPermanentlyAction,
} from "../student.action";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

interface DeleteStudentsDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  students: Row<IStudent>["original"][];
  /** Si true : retire de la branche (garde le membre org). */
  permanent?: boolean;
}

export function DeleteStudentsDialog({
  showTrigger = true,
  onSuccess,
  students,
  permanent = false,
  ...props
}: DeleteStudentsDialogProps) {
  const peopleLabels = useBranchPeopleLabels();
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const handleConfirm = () => {
    startTransition(async () => {
      let hasError = false;
      for (const student of students) {
        const [result, err] = permanent
          ? await deleteStudentPermanentlyAction({ id: student.id })
          : await archiveStudentAction({ id: student.id });

        if (err) {
          toast.error(
            err.message ??
              (permanent
                ? "Erreur lors de la suppression"
                : "Erreur lors de l'archivage"),
          );
          hasError = true;
        } else if (!result?.ok) {
          toast.error(
            result?.message ??
              (permanent
                ? "Erreur lors de la suppression"
                : "Erreur lors de l'archivage"),
          );
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          permanent
            ? students.length === 1
              ? `${peopleLabels.student} désactivé dans la branche`
              : `${peopleLabels.studentPlural} désactivés dans la branche`
            : students.length === 1
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
            {permanent ? (
              <IconTrash className="mr-2 size-4" aria-hidden="true" />
            ) : (
              <IconArchive className="mr-2 size-4" aria-hidden="true" />
            )}
            {permanent ? `Supprimer (${count})` : `Archiver (${count})`}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {permanent
              ? count === 1
                ? `Désactiver ${peopleLabels.studentLower} dans cette branche ?`
                : `Désactiver ${count} ${peopleLabels.studentPluralLower} dans cette branche ?`
              : count === 1
                ? peopleLabels.archiveTitle
                : `Archiver ${count} ${peopleLabels.studentPluralLower} ?`}
          </DialogTitle>
          <DialogDescription>
            {permanent
              ? count === 1
                ? "Il ne sera plus visible dans cette branche, mais restera membre de l'organisation. Présences, notes et inscriptions restent pour les rapports. Ses autres branches ne sont pas affectées."
                : "Ils ne seront plus visibles dans cette branche, mais resteront membres de l'organisation. L'historique est conservé pour les rapports."
              : count === 1
                ? peopleLabels.archiveDescriptionSingular
                : peopleLabels.archiveDescriptionPlural}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label={
              permanent ? "Désactiver dans la branche" : "Archiver la sélection"
            }
            variant={permanent ? "destructive" : "outline"}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {permanent ? "Désactiver" : "Archiver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
