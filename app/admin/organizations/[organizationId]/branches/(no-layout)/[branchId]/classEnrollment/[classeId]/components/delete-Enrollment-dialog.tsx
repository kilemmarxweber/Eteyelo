"use client";

import * as React from "react";
import { IconReload, IconTrash } from "@tabler/icons-react";
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
import { IclassEnrollment } from "@/src/interfaces/classEnrollment";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { deleteClassEnrollAction } from "../../classEnrollment.action";

interface DeleteEnrollmentsDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  enrollments: Row<IclassEnrollment>["original"][];
}

export function DeleteClassEnrollmentsDialog({
  showTrigger = true,
  onSuccess,
  enrollments,
  ...props
}: DeleteEnrollmentsDialogProps) {
  const [isDeletePending, startDeleteTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleDelete = async () => {
    startDeleteTransition(async () => {
      for (const enrollment of enrollments) {
        try {
          await deleteClassEnrollAction({
            id: enrollment.id,
            schoolYearId: enrollment.schoolYearId ?? "",
            studentId: enrollment.studentId ?? "",
            classeId: enrollment.classeId ?? ""

          });
        } catch (err) {
          toast.error(`Failed to delete enrollment ${enrollment.id}: ${err}`);
        }
      }

      onSuccess?.();
      setTimeout(() => {
        console.log("Component refreshed");
        refresh();
      }, 1000);
    });
  };

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconTrash className="mr-2 size-4" aria-hidden="true" />
            Delete ({enrollments.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée.Cela supprimera en permanence
            votre <span className="font-medium">{enrollments.length}</span>
            {enrollments.length === 1 ? " enrollment" : " enrollments"} from our
            servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            aria-label="Delete selected rows"
            variant="destructive"
            onClick={() => {
              props.onOpenChange?.(false);
              toast.success("Enrollments deleted");
              onSuccess?.();
              handleDelete()
            }}
            disabled={isDeletePending}
          >
            {isDeletePending && (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
