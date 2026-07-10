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
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { deleteSchoolYearAction } from "../schoolYear.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteSchoolYearsDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  SchoolYears: Row<ISchoolYear>["original"][];
}

export function DeleteSchoolYearsDialog({
  showTrigger = true,
  onSuccess,
  SchoolYears,
  ...props
}: DeleteSchoolYearsDialogProps) {
  const [isDeletePending, startDeleteTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleDelete = async () => {
    startDeleteTransition(async () => {
      for (const schoolYear of SchoolYears) {
        try {
          await deleteSchoolYearAction({
            id: schoolYear.id,
          });
        } catch (err) {
          toast.error(`Failed to delete schoolYear ${schoolYear.id}: ${err}`);
        }
      }

      onSuccess?.();
      window.dispatchEvent(new Event("school-year-refresh"));
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
            Delete ({SchoolYears.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée.Cela supprimera en permanence
            votre <span className="font-medium">{SchoolYears.length}</span>
            {SchoolYears.length === 1 ? " SchoolYear" : " SchoolYears"} from our
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
              toast.success("SchoolYears deleted");
              onSuccess?.();
              handleDelete();
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
