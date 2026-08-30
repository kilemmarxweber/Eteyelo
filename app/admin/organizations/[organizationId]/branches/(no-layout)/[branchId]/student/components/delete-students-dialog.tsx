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
import { useTranslations } from "next-intl";
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
  const t = useTranslations("users.students.delete");
  const tCommon = useTranslations("common");
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
              (permanent ? tCommon("errorDelete") : tCommon("errorArchive")),
          );
          hasError = true;
        } else if (!result?.ok) {
          toast.error(
            result?.message ??
              (permanent ? tCommon("errorDelete") : tCommon("errorArchive")),
          );
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          permanent
            ? students.length === 1
              ? t("deactivatedOne", { student: peopleLabels.student })
              : t("deactivatedMany", { students: peopleLabels.studentPlural })
            : students.length === 1
              ? t("archivedOne", { student: peopleLabels.student })
              : t("archivedMany", { students: peopleLabels.studentPlural }),
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
            {permanent ? `${tCommon("delete")} (${count})` : `${tCommon("archive")} (${count})`}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {permanent
              ? count === 1
                ? t("deactivateOne", { studentLower: peopleLabels.studentLower })
                : t("deactivateMany", { count, studentsLower: peopleLabels.studentPluralLower })
              : count === 1
                ? peopleLabels.archiveTitle
                : t("archiveMany", { count, studentsLower: peopleLabels.studentPluralLower })}
          </DialogTitle>
          <DialogDescription>
            {permanent
              ? count === 1
                ? t("permanentDescOne")
                : t("permanentDescMany")
              : count === 1
                ? peopleLabels.archiveDescriptionSingular
                : peopleLabels.archiveDescriptionPlural}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">{tCommon("cancel")}</Button>
          </DialogClose>
          <Button
            aria-label={
              permanent ? t("deactivateInBranch") : tCommon("archiveSelection")
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
            {permanent ? tCommon("deactivate") : tCommon("archive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
