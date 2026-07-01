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
import { ISection } from "@/src/interfaces/Section";
import { deleteSectionAction } from "../section.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteSectionsDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Sections: Row<ISection>["original"][];
}

export function DeleteSectionsDialog({
  showTrigger = true,
  onSuccess,
  Sections,
  ...props
}: DeleteSectionsDialogProps) {
  const [isDeletePending, startDeleteTransition] = React.useTransition();

  const { refresh } = useRefresh()
  const handleDelete = async () => {
    startDeleteTransition(async () => {
      for (const section of Sections) {
        try {
          await deleteSectionAction({
            id: section.id,
            codeSection: section.codeSection,
            nameSection: section.nameSection,
          })
        } catch (err) {
          toast.error(`Failed to delete section ${section.id}: ${err}`);
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
            Delete ({Sections.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée.Cela supprimera en permanence
            votre <span className="font-medium">{Sections.length}</span>
            {Sections.length === 1 ? " Section" : " Sections"} from our servers.
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
              toast.success("Sections deleted");
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
