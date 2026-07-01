"use client";

import * as React from "react";
import {IconReload, IconTrash} from "@tabler/icons-react"
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
import { IOption } from "@/src/interfaces/Option";
import { deleteOptionAction } from "../option.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteOptionsDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Options: Row<IOption>["original"][];
}

export function DeleteOptionsDialog({
  showTrigger = true,
  onSuccess,
  Options,
  ...props
}: DeleteOptionsDialogProps) {
  const [isDeletePending, startDeleteTransition] = React.useTransition();

  const { refresh } = useRefresh()
  const handleDelete = async () => {
    startDeleteTransition(async () => {
      for (const option of Options) {
        try {
          await deleteOptionAction({
            id: option.id,
            codeOption: option.codeOption,
            nameOption: option.nameOption,
          })
        } catch (err) {
          toast.error(`Failed to delete option ${option.id}: ${err}`);
        }
      }
  
      onSuccess?.()
      setTimeout(() => {
        console.log("Component refreshed")
        refresh()
      }, 1000)
    });
  };

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconTrash className="mr-2 size-4" aria-hidden="true" />
            Delete ({Options.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée.Cela supprimera en permanence
            votre <span className="font-medium">{Options.length}</span>
            {Options.length === 1 ? " Option" : " Options"} from our servers.
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
              toast.success("Options deleted");
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
